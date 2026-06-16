public static class Program
{
    public static async Task Main()
    {
        var tests = await LessonTests.RunAsync();
        Console.WriteLine(JsonSerializer.Serialize(new { tests }));
    }
}
