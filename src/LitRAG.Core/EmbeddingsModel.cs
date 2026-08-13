namespace LitRAG.Core;

using Microsoft.Extensions.AI;
using OpenAI;
using OpenAI.Embeddings;
using System.ClientModel;

public class EmbeddingsModel
{
	private IEmbeddingGenerator<string, Embedding<float>> embeddingGenerator;

	public EmbeddingsModel()
	{
		var options = new OpenAIClientOptions
		{
			Endpoint = new Uri("http://10.88.111.7:1234/v1")
		};

		var openAIClient = new OpenAIClient(new ApiKeyCredential("lm-studio"), options);

		EmbeddingClient embeddingClient = openAIClient.GetEmbeddingClient("nomic-ai/nomic-embed-text-v1.5-GGUF");

		embeddingGenerator =
			embeddingClient.AsIEmbeddingGenerator();
	}

	async public Task<Embedding<float>> GenerateEmbeddings(string text)
	{
		return await embeddingGenerator.GenerateAsync(text);
	}
}
