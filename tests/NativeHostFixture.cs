using System;
using System.IO;
using System.Text;

internal static class NativeHostFixture
{
    private static int Main()
    {
        string file = Environment.GetEnvironmentVariable("CHATGPT_FIREFOX_TEST_FILE") ?? String.Empty;
        string escaped = file.Replace("\\", "\\\\").Replace("\"", "\\\"");
        string nested = "{\\\"localAppServerUrl\\\":\\\"ws://localhost:45678?clientId=nested\\\"}";
        string json = "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"executeCdp\",\"appServerUrl\":\"ws://127.0.0.1:45678?token=test\",\"serializedResult\":\"" + nested + "\",\"params\":{\"method\":\"DOM.setFileInputFiles\",\"commandParams\":{\"files\":[\"" + escaped + "\"]}}}";
        byte[] payload = Encoding.UTF8.GetBytes(json);
        Stream output = Console.OpenStandardOutput();
        byte[] header = BitConverter.GetBytes(payload.Length);
        output.Write(header, 0, header.Length);
        output.Write(payload, 0, payload.Length);
        output.Flush();
        return 0;
    }
}
