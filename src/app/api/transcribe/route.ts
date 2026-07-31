export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return Response.json({ error: "Server GROQ_API_KEY not configured." }, { status: 501 });

  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Missing audio file." }, { status: 400 });
  if (file.size > 25 * 1024 * 1024)
    return Response.json({ error: "File exceeds the 25 MB Groq limit." }, { status: 413 });

  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");

  const upstream = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
