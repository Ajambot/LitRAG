namespace LitRAG.Core;

using Qdrant.Client;
using Qdrant.Client.Grpc;

public sealed class VectorDB
{
	private QdrantClient client;

	public VectorDB()
	{
		client = new QdrantClient("127.0.0.1", 6334);
	}

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
