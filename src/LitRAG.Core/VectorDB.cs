namespace LitRAG.Core;

using Qdrant.Client;
using Qdrant.Client.Grpc;

public sealed class VectorDB(string host, int port)
{
	private readonly QdrantClient client = new(host, port);

	async public Task CreateCollection()
	{
		if (!await client.CollectionExistsAsync("papers"))
		{
			await client.CreateCollectionAsync(
					collectionName: "papers",
					vectorsConfig: new VectorParams { Size = 768, Distance = Distance.Cosine }
					);
		}
	}

	async public Task InsertPoint(float[] embedding, string text)
	{
		var point = new PointStruct
		{
			Id = Guid.NewGuid(),
			Vectors = embedding,
			Payload =
			{
				["text"] = text,
			}
		};

		await client.UpsertAsync("papers", new List<PointStruct> { point });
	}
}
