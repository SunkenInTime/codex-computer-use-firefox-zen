using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

internal static class NativeHostProxy
{
    private const string OfficialChromeOrigin = "chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/";
    private static readonly object StdoutLock = new object();
    private static readonly Regex LoopbackWebSocketUrl = new Regex(
        @"ws://(?:127\.0\.0\.1|localhost):(?<port>\d+)(?<tail>(?:[/?#][^\s""'\\<>]*)?)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
    private static TcpListener webSocketRelay;
    private static int webSocketRelayPort;
    private static int upstreamWebSocketPort;

    private static int Main()
    {
        try
        {
            StartWebSocketRelay();
            string hostPath = Environment.GetEnvironmentVariable("CHATGPT_FIREFOX_ORIGINAL_HOST");
            if (String.IsNullOrWhiteSpace(hostPath))
            {
                string pathFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "native-host-proxy.path");
                hostPath = File.ReadAllText(pathFile).Trim();
            }

            if (!File.Exists(hostPath))
            {
                throw new FileNotFoundException("The original OpenAI extension host was not found.", hostPath);
            }

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = hostPath;
            startInfo.Arguments = "\"" + OfficialChromeOrigin + "\" 0";
            startInfo.WorkingDirectory = Path.GetDirectoryName(hostPath);
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            startInfo.RedirectStandardInput = true;
            startInfo.RedirectStandardOutput = true;
            startInfo.RedirectStandardError = true;

            using (Process child = Process.Start(startInfo))
            {
                Thread inputThread = new Thread(delegate()
                {
                    try
                    {
                        CopyRaw(Console.OpenStandardInput(), child.StandardInput.BaseStream);
                    }
                    catch (Exception error)
                    {
                        WriteError("stdin forwarding failed: " + error.Message);
                    }
                    finally
                    {
                        try { child.StandardInput.Close(); } catch { }
                    }
                });

                Thread outputThread = new Thread(delegate()
                {
                    try
                    {
                        CopyNativeMessages(child.StandardOutput.BaseStream, Console.OpenStandardOutput());
                    }
                    catch (Exception error)
                    {
                        WriteError("stdout forwarding failed: " + error.Message);
                    }
                });

                Thread errorThread = new Thread(delegate()
                {
                    try { CopyRaw(child.StandardError.BaseStream, Console.OpenStandardError()); }
                    catch { }
                });

                inputThread.IsBackground = true;
                outputThread.IsBackground = true;
                errorThread.IsBackground = true;
                inputThread.Start();
                outputThread.Start();
                errorThread.Start();

                child.WaitForExit();
                outputThread.Join(2000);
                errorThread.Join(500);
                return child.ExitCode;
            }
        }
        catch (Exception error)
        {
            WriteError(error.ToString());
            return 1;
        }
        finally
        {
            try { if (webSocketRelay != null) webSocketRelay.Stop(); } catch { }
        }
    }

    private static void CopyRaw(Stream input, Stream output)
    {
        byte[] buffer = new byte[64 * 1024];
        int count;
        while ((count = input.Read(buffer, 0, buffer.Length)) > 0)
        {
            output.Write(buffer, 0, count);
            output.Flush();
        }
    }

    private static void CopyNativeMessages(Stream input, Stream output)
    {
        byte[] header = new byte[4];
        while (ReadExact(input, header, 0, header.Length, true))
        {
            int length = BitConverter.ToInt32(header, 0);
            if (length < 0 || length > 1024 * 1024 * 1024)
            {
                throw new InvalidDataException("Invalid native-message length: " + length);
            }

            byte[] payload = new byte[length];
            ReadExact(input, payload, 0, length, false);
            byte[] enriched = EnrichNativeMessage(payload);
            byte[] enrichedHeader = BitConverter.GetBytes(enriched.Length);
            output.Write(enrichedHeader, 0, enrichedHeader.Length);
            output.Write(enriched, 0, enriched.Length);
            output.Flush();
        }
    }

    private static bool ReadExact(Stream input, byte[] buffer, int offset, int count, bool allowCleanEof)
    {
        int total = 0;
        while (total < count)
        {
            int read = input.Read(buffer, offset + total, count - total);
            if (read == 0)
            {
                if (allowCleanEof && total == 0) return false;
                throw new EndOfStreamException("Native message ended unexpectedly.");
            }
            total += read;
        }
        return true;
    }

    private static byte[] EnrichNativeMessage(byte[] payload)
    {
        try
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            serializer.MaxJsonLength = Int32.MaxValue;
            serializer.RecursionLimit = 512;
            object root = serializer.DeserializeObject(Encoding.UTF8.GetString(payload));
            bool changed = EnrichCommands(root);
            changed = RewriteWebSocketUrls(root) || changed;
            if (!changed) return payload;
            return Encoding.UTF8.GetBytes(serializer.Serialize(root));
        }
        catch (Exception error)
        {
            WriteError("file-upload enrichment skipped: " + error.Message);
            return payload;
        }
    }

    private static bool RewriteWebSocketUrls(object value)
    {
        bool changed = false;
        IDictionary<string, object> dictionary = value as IDictionary<string, object>;
        if (dictionary != null)
        {
            List<string> keys = new List<string>(dictionary.Keys);
            foreach (string key in keys)
            {
                string text = dictionary[key] as string;
                string rewritten;
                if (text != null && TryRewriteWebSocketUrls(text, out rewritten))
                {
                    dictionary[key] = rewritten;
                    changed = true;
                }
                else
                {
                    changed = RewriteWebSocketUrls(dictionary[key]) || changed;
                }
            }
            return changed;
        }

        IList list = value as IList;
        if (list != null && !(value is string))
        {
            for (int index = 0; index < list.Count; index++)
            {
                string text = list[index] as string;
                string rewritten;
                if (text != null && TryRewriteWebSocketUrls(text, out rewritten))
                {
                    list[index] = rewritten;
                    changed = true;
                }
                else
                {
                    changed = RewriteWebSocketUrls(list[index]) || changed;
                }
            }
        }
        return changed;
    }

    private static bool TryRewriteWebSocketUrls(string value, out string rewritten)
    {
        if (webSocketRelayPort <= 0 || !LoopbackWebSocketUrl.IsMatch(value))
        {
            rewritten = value;
            return false;
        }

        bool changed = false;
        rewritten = LoopbackWebSocketUrl.Replace(value, delegate(Match match)
        {
            int port;
            if (!Int32.TryParse(match.Groups["port"].Value, out port) || port == webSocketRelayPort)
            {
                return match.Value;
            }

            Interlocked.Exchange(ref upstreamWebSocketPort, port);
            changed = true;
            return "ws://127.0.0.1:" + webSocketRelayPort + match.Groups["tail"].Value;
        });
        return changed;
    }

    private static void StartWebSocketRelay()
    {
        webSocketRelay = new TcpListener(IPAddress.Loopback, 0);
        webSocketRelay.Start();
        webSocketRelayPort = ((IPEndPoint)webSocketRelay.LocalEndpoint).Port;
        Thread listenerThread = new Thread(delegate()
        {
            while (true)
            {
                try
                {
                    TcpClient browser = webSocketRelay.AcceptTcpClient();
                    Thread clientThread = new Thread(delegate() { RelayWebSocket(browser); });
                    clientThread.IsBackground = true;
                    clientThread.Start();
                }
                catch (SocketException)
                {
                    return;
                }
                catch (ObjectDisposedException)
                {
                    return;
                }
                catch (Exception error)
                {
                    WriteError("WebSocket accept failed: " + error.Message);
                }
            }
        });
        listenerThread.IsBackground = true;
        listenerThread.Start();
    }

    private static void RelayWebSocket(TcpClient browser)
    {
        using (browser)
        {
            try
            {
                int upstreamPort = Interlocked.CompareExchange(ref upstreamWebSocketPort, 0, 0);
                if (upstreamPort <= 0) throw new InvalidOperationException("The upstream app-server port is not available yet.");

                NetworkStream browserStream = browser.GetStream();
                byte[] requestBytes = ReadHttpHeaders(browserStream);
                string request = Encoding.ASCII.GetString(requestBytes);
                request = Regex.Replace(request, @"(?im)^Origin:[^\r\n]*", "Origin: " + OfficialChromeOrigin);
                request = Regex.Replace(request, @"(?im)^Host:[^\r\n]*", "Host: 127.0.0.1:" + upstreamPort);

                using (TcpClient upstream = new TcpClient())
                {
                    upstream.Connect(IPAddress.Loopback, upstreamPort);
                    NetworkStream upstreamStream = upstream.GetStream();
                    byte[] rewrittenRequest = Encoding.ASCII.GetBytes(request);
                    upstreamStream.Write(rewrittenRequest, 0, rewrittenRequest.Length);
                    upstreamStream.Flush();

                    Thread browserToUpstream = new Thread(delegate()
                    {
                        try { CopyRaw(browserStream, upstreamStream); } catch { }
                        try { upstream.Client.Shutdown(SocketShutdown.Send); } catch { }
                    });
                    browserToUpstream.IsBackground = true;
                    browserToUpstream.Start();
                    CopyRaw(upstreamStream, browserStream);
                    browserToUpstream.Join(500);
                }
            }
            catch (Exception error)
            {
                WriteError("WebSocket relay failed: " + error.Message);
            }
        }
    }

    private static byte[] ReadHttpHeaders(Stream input)
    {
        using (MemoryStream buffer = new MemoryStream())
        {
            int matched = 0;
            byte[] terminator = new byte[] { 13, 10, 13, 10 };
            while (buffer.Length < 64 * 1024)
            {
                int next = input.ReadByte();
                if (next < 0) throw new EndOfStreamException("WebSocket handshake ended before its headers completed.");
                buffer.WriteByte((byte)next);
                if (next == terminator[matched])
                {
                    matched += 1;
                    if (matched == terminator.Length) return buffer.ToArray();
                }
                else
                {
                    matched = next == terminator[0] ? 1 : 0;
                }
            }
        }
        throw new InvalidDataException("WebSocket handshake headers are too large.");
    }

    private static bool EnrichCommands(object value)
    {
        bool changed = false;
        IDictionary<string, object> dictionary = value as IDictionary<string, object>;
        if (dictionary != null)
        {
            object methodValue;
            if (dictionary.TryGetValue("method", out methodValue) &&
                String.Equals(methodValue as string, "DOM.setFileInputFiles", StringComparison.Ordinal))
            {
                IDictionary<string, object> command = dictionary;
                object parametersValue;
                IDictionary<string, object> parameters;
                if (dictionary.TryGetValue("commandParams", out parametersValue) &&
                    (parameters = parametersValue as IDictionary<string, object>) != null)
                {
                    command = parameters;
                }
                else if (dictionary.TryGetValue("params", out parametersValue) &&
                         (parameters = parametersValue as IDictionary<string, object>) != null)
                {
                    command = parameters;
                }

                object filesValue;
                IEnumerable files = command.TryGetValue("files", out filesValue) ? filesValue as IEnumerable : null;
                if (files != null && !(filesValue is string))
                {
                    List<object> payloads = new List<object>();
                    foreach (object fileValue in files)
                    {
                        string path = fileValue as string;
                        if (String.IsNullOrWhiteSpace(path) || !File.Exists(path)) continue;
                        FileInfo info = new FileInfo(path);
                        Dictionary<string, object> file = new Dictionary<string, object>();
                        file["path"] = info.FullName;
                        file["name"] = info.Name;
                        file["type"] = MimeType(info.Extension);
                        file["lastModified"] = new DateTimeOffset(info.LastWriteTimeUtc).ToUnixTimeMilliseconds();
                        file["data"] = Convert.ToBase64String(File.ReadAllBytes(info.FullName));
                        payloads.Add(file);
                    }
                    if (payloads.Count > 0)
                    {
                        command["_firefoxFilePayloads"] = payloads.ToArray();
                        changed = true;
                    }
                }
            }

            foreach (KeyValuePair<string, object> item in dictionary)
            {
                changed = EnrichCommands(item.Value) || changed;
            }
            return changed;
        }

        IEnumerable sequence = value as IEnumerable;
        if (sequence != null && !(value is string))
        {
            foreach (object item in sequence)
            {
                changed = EnrichCommands(item) || changed;
            }
        }
        return changed;
    }

    private static string MimeType(string extension)
    {
        switch ((extension ?? String.Empty).ToLowerInvariant())
        {
            case ".txt": return "text/plain";
            case ".html": case ".htm": return "text/html";
            case ".json": return "application/json";
            case ".csv": return "text/csv";
            case ".pdf": return "application/pdf";
            case ".png": return "image/png";
            case ".jpg": case ".jpeg": return "image/jpeg";
            case ".gif": return "image/gif";
            case ".webp": return "image/webp";
            case ".svg": return "image/svg+xml";
            case ".zip": return "application/zip";
            default: return "application/octet-stream";
        }
    }

    private static void WriteError(string message)
    {
        try
        {
            lock (StdoutLock)
            {
                Console.Error.WriteLine("[chatgpt-firefox-native-host] " + message);
                Console.Error.Flush();
            }
        }
        catch { }
    }
}
