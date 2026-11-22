namespace LitRAG.Core;

using Qdrant.Client;
using Qdrant.Client.Grpc;

public sealed class VectorDB(string host, int port)
{
	private readonly QdrantClient client = new(host, port);

	async public Task EnsureCreated()
	{
		if (!await IsCreated())
		{
			await client.CreateCollectionAsync(
					collectionName: "papers",
					vectorsConfig: new VectorParams { Size = 768, Distance = Distance.Cosine }
					);
		}
	}

	async public Task<bool> IsCreated()
	{
		return await client.CollectionExistsAsync("papers");
	}

	async public Task InsertPoint(float[] embedding, string text, string importedFile)
	{
		var point = new PointStruct
		{
			Id = Guid.NewGuid(),
			Vectors = embedding,
			Payload =
			{
				["text"] = text,
				["importedFile"] = importedFile,
			}
		};

		await client.UpsertAsync("papers", new List<PointStruct> { point });
	}

	async public Task DeleteByImportedFile(string importedFile)
	{
		if (!await IsCreated())
		{
			return;
		}

		var filter = new Filter();
		filter.Must.Add(Conditions.MatchKeyword("importedFile", importedFile));
		await client.DeleteAsync("papers", filter);
	}

	async public Task<List<QueryMatch>> Query(float[] queryVector)
	{
		var searchResult = await client.QueryAsync(
				"papers",
				query: queryVector,
				limit: 5,
				payloadSelector: true
				);

		List<QueryMatch> matches = [];
		foreach (var point in searchResult)
		{
			var chunkText = point.Payload["text"].StringValue;
			var score = point.Score;
			matches.Add(new QueryMatch(chunkText, score));
		}
		return matches;
	}
}
