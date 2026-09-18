export async function getEmbedding(text: string): Promise<number[]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000), // keep it within token limits
      }),
    });
  
    const data = await res.json();
  
    if (!data.data) {
      throw new Error(`Embedding failed: ${JSON.stringify(data)}`);
    }
  
    return data.data[0].embedding;
  }
  
  export function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
  
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
  
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }