namespace LitRAG.Core;

using System.Text.Json.Serialization;

public sealed record Message(string Role, string Text);
public sealed record QueryRequest(Message[] Conversation);

public sealed record QueryMatch(string Text, float Score);

public sealed record ImportedFile(
	string Name,
	string Status,
	[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null);
