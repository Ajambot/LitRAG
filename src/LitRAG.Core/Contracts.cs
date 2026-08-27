namespace LitRAG.Core;

public sealed record QueryRequest(string Query);

public sealed record QueryMatch(string Text, float Score);
