export default async function handler(
  req: { query: { url: any } },
  res: {
    setHeader: (arg0: string, arg1: string) => void;
    send: (arg0: Buffer) => void;
  }
) {
  const { url } = req.query;
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  res.setHeader("Content-Type", "audio/mpeg");
  res.send(Buffer.from(data));
}
