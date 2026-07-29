namespace LitRAG.Core;

using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;
using System.ClientModel;
using OpenAI;

public sealed class SectionParserAgent
{
	private AIAgent agent;
	private readonly string prompt = """
		You are a document parser for research article PDFs. You'll receive raw extracted text that may contain artifacts like broken line wraps, repeated headers/footers, page numbers, or multi-column reordering issues.

		Your task:
		1. Read the text and identify its high - level sections based on the article's own structure (e.g., Abstract, Introduction, Methods, Results, Discussion, References, or whatever headings/divisions the article actually uses — they don't need to match a standard taxonomy, but keep them high-level rather than granular subsections).
		2. Clean up nonsensical text: rejoin words split by line-break hyphens, remove repeated running headers/footers and page numbers, and collapse stray whitespace / line breaks — without altering or paraphrasing the actual content.
		3. Return the result as a dictionary mapping each section name to its full cleaned content.

		Rules:
		- Preserve the original wording of the body text exactly; only remove extraction artifacts, never summarize or rewrite.
		- Use the article's own section names where sensible; if a section is unlabeled (e.g., an abstract with no heading), infer a reasonable high-level name for it.
		- Keep full section content — do not truncate for brevity.
		- If some text doesn't clearly belong to any section, place it under a "Unclassified" key rather than forcing it elsewhere.

		Output strictly as a JSON object in the form:
		{
			"Section Name": "full cleaned content of that section",
			...
		}
		No commentary, no markdown fences — just the JSON object.
		""";

	public SectionParserAgent()
	{
		var options = new OpenAIClientOptions
		{
			Endpoint = new Uri("http://10.88.111.7:1234/v1")
		};

		var APIKey = new ApiKeyCredential("<your_api_key>");
		OpenAIClient OAIClient = new OpenAIClient(APIKey, options);
		var client = OAIClient.GetChatClient("qwen/qwen3.5-9b").AsIChatClient();


		agent = client.AsAIAgent(
				instructions: prompt,
				name: "Parser");
	}

	public async Task<AgentResponse> ParseSections(string rawText)
	{
		var response = await agent.RunAsync(
				$$"""
				Raw extracted text:
				{{rawText}}
				""");
		return response;
	}
}
