namespace LitRAG.Core;

public sealed record Message(string Role, string Text);
public sealed record QueryRequest(Message[] Conversation);

public sealed record QueryMatch(string Text, float Score);
