using CodeRehab.DotNetRunner.Services;

namespace CodeRehab.DotNetRunner.Tests;

public sealed class ResultParserTests
{
    [Fact]
    public void ParsesLastJsonResultLineAndLeavesUserOutput()
    {
        const string stdout = """
        user log
        {"tests":[{"name":"one","passed":true,"message":"OK"}]}
        """;

        var parser = new ResultParser();
        var tests = parser.TryParseTests(stdout);

        Assert.NotNull(tests);
        Assert.Single(tests);
        Assert.True(tests[0].Passed);
        Assert.Equal("user log", parser.RemoveResultLine(stdout));
    }
}
