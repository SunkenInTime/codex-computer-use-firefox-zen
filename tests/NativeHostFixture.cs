using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

internal static class NativeHostFixture
{
    private const int OutputLimit = 1024 * 1024;
    private const int LingeringHostMilliseconds = 3000;

    private static int Main()
    {
        string mode = Environment.GetEnvironmentVariable("CHATGPT_FIREFOX_FIXTURE_MODE") ?? "file-upload";
        if (mode == "output-at-limit")
        {
            WriteSizedMessage("output-at-limit", OutputLimit);
            return 0;
        }
        if (mode == "output-above-limit")
        {
            WriteSizedMessage("output-above-limit", OutputLimit + 1);
            return 0;
        }
        if (mode == "output-above-limit-then-normal")
        {
            WriteSizedMessage("output-above-limit", OutputLimit + 1);
            WriteFrame(Encoding.UTF8.GetBytes("{\"kind\":\"normal-after-oversize\"}"));
            return 0;
        }
        if (mode == "output-above-limit-then-wait")
        {
            WriteSizedMessage("output-above-limit", OutputLimit + 1);
            Thread.Sleep(LingeringHostMilliseconds);
            File.WriteAllText(Environment.GetEnvironmentVariable("CHATGPT_FIREFOX_FIXTURE_COMPLETION_MARKER"), "completed");
            return 0;
        }
        if (mode == "output-above-limit-header-then-wait")
        {
            WriteHeader(OutputLimit + 1);
            Thread.Sleep(LingeringHostMilliseconds);
            File.WriteAllText(Environment.GetEnvironmentVariable("CHATGPT_FIREFOX_FIXTURE_COMPLETION_MARKER"), "completed");
            return 0;
        }
        if (mode == "output-above-limit-header-then-stderr-descendant")
        {
            SpawnDescendantThatRetainsStderr();
            WriteHeader(OutputLimit + 1);
            return 0;
        }
        if (mode == "write-completion-marker-after-wait")
        {
            Thread.Sleep(LingeringHostMilliseconds);
            File.WriteAllText(Environment.GetEnvironmentVariable("CHATGPT_FIREFOX_FIXTURE_COMPLETION_MARKER"), "completed");
            return 0;
        }
        if (mode == "enrichment-overflow")
        {
            WriteEnrichmentOverflow();
            return 0;
        }
        if (mode == "oversized-file-upload")
        {
            WriteOversizedFileUpload();
            return 0;
        }
        if (mode == "verify-truncated-input")
        {
            string result = ReceivesInputWithin(100)
                ? "{\"kind\":\"truncated-input-forwarded\"}"
                : "{\"kind\":\"truncated-input-not-forwarded\"}";
            WriteFrame(Encoding.UTF8.GetBytes(result));
            return 0;
        }
        if (mode == "echo-input")
        {
            byte[] input = ReadInputWithin(100);
            if (input.Length >= 4 && input.Length == BitConverter.ToUInt32(input, 0) + 4)
            {
                byte[] payload = new byte[input.Length - 4];
                Buffer.BlockCopy(input, 4, payload, 0, payload.Length);
                WriteFrame(payload);
            }
            else
            {
                WriteFrame(Encoding.UTF8.GetBytes("{\"kind\":\"invalid-echo-input\"}"));
            }
            return 0;
        }
        if (mode == "verify-large-input")
        {
            byte[] input = ReadInputWithin(3000);
            bool valid = input.Length >= 4
                && input.Length == BitConverter.ToUInt32(input, 0) + 4
                && HasOnlyInputBytes(input, 4);
            string result = "{\"kind\":\"" + (valid ? "large-input-received" : "large-input-invalid") + "\",\"receivedLength\":" + input.Length + "}";
            WriteFrame(Encoding.UTF8.GetBytes(result));
            return 0;
        }

        string file = Environment.GetEnvironmentVariable("CHATGPT_FIREFOX_TEST_FILE") ?? String.Empty;
        string escaped = file.Replace("\\", "\\\\").Replace("\"", "\\\"");
        string nested = "{\\\"localAppServerUrl\\\":\\\"ws://localhost:45678?clientId=nested\\\"}";
        string json = "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"executeCdp\",\"appServerUrl\":\"ws://127.0.0.1:45678?token=test\",\"serializedResult\":\"" + nested + "\",\"params\":{\"method\":\"DOM.setFileInputFiles\",\"commandParams\":{\"files\":[\"" + escaped + "\"]}}}";
        WriteFrame(Encoding.UTF8.GetBytes(json));
        return 0;
    }

    private static void WriteSizedMessage(string kind, int length)
    {
        byte[] prefix = Encoding.UTF8.GetBytes("{\"kind\":\"" + kind + "\",\"data\":\"");
        byte[] suffix = Encoding.UTF8.GetBytes("\"}");
        WriteSizedPayload(prefix, suffix, length);
    }

    private static void WriteEnrichmentOverflow()
    {
        byte[] prefix = Encoding.UTF8.GetBytes("{\"method\":\"getInfo\",\"padding\":\"");
        byte[] suffix = Encoding.UTF8.GetBytes("\"}");
        WriteSizedPayload(prefix, suffix, OutputLimit);
    }

    private static void WriteOversizedFileUpload()
    {
        string file = Environment.GetEnvironmentVariable("CHATGPT_FIREFOX_TEST_FILE") ?? String.Empty;
        string escaped = file.Replace("\\", "\\\\").Replace("\"", "\\\"");
        string json = "{\"method\":\"DOM.setFileInputFiles\",\"params\":{\"files\":[\"" + escaped + "\"]}}";
        WriteFrame(Encoding.UTF8.GetBytes(json));
    }

    private static void WriteSizedPayload(byte[] prefix, byte[] suffix, int length)
    {
        byte[] payload = new byte[length];
        Buffer.BlockCopy(prefix, 0, payload, 0, prefix.Length);
        for (int index = prefix.Length; index < length - suffix.Length; index += 1)
        {
            payload[index] = (byte)'x';
        }
        Buffer.BlockCopy(suffix, 0, payload, length - suffix.Length, suffix.Length);
        WriteFrame(payload);
    }

    private static void WriteFrame(byte[] payload)
    {
        Stream output = Console.OpenStandardOutput();
        byte[] header = BitConverter.GetBytes(payload.Length);
        output.Write(header, 0, header.Length);
        output.Write(payload, 0, payload.Length);
        output.Flush();
    }

    private static void WriteHeader(int length)
    {
        Stream output = Console.OpenStandardOutput();
        byte[] header = BitConverter.GetBytes(length);
        output.Write(header, 0, header.Length);
        output.Flush();
    }

    private static void SpawnDescendantThatRetainsStderr()
    {
        ProcessStartInfo start = new ProcessStartInfo
        {
            FileName = Process.GetCurrentProcess().MainModule.FileName,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = false
        };
        start.EnvironmentVariables["CHATGPT_FIREFOX_FIXTURE_MODE"] = "write-completion-marker-after-wait";
        Process.Start(start);
    }

    private static bool HasOnlyInputBytes(byte[] input, int offset)
    {
        for (int index = offset; index < input.Length; index += 1)
        {
            if (input[index] != (byte)'i')
            {
                return false;
            }
        }
        return true;
    }

    private static bool ReceivesInputWithin(int milliseconds)
    {
        byte[] buffer = new byte[1];
        Task<int> read = Console.OpenStandardInput().ReadAsync(buffer, 0, buffer.Length);
        return read.Wait(milliseconds) && read.Result > 0;
    }

    private static byte[] ReadInputWithin(int milliseconds)
    {
        Stream input = Console.OpenStandardInput();
        byte[] chunk = new byte[4096];
        using (MemoryStream buffer = new MemoryStream())
        {
            DateTime deadline = DateTime.UtcNow.AddMilliseconds(milliseconds);
            while (DateTime.UtcNow < deadline)
            {
                int remaining = Math.Max(1, (int)(deadline - DateTime.UtcNow).TotalMilliseconds);
                Task<int> read = input.ReadAsync(chunk, 0, chunk.Length);
                if (!read.Wait(remaining) || read.Result == 0)
                {
                    break;
                }
                buffer.Write(chunk, 0, read.Result);
                byte[] bytes = buffer.ToArray();
                if (bytes.Length >= 4 && bytes.Length >= BitConverter.ToUInt32(bytes, 0) + 4)
                {
                    return bytes;
                }
            }
            return buffer.ToArray();
        }
    }
}
