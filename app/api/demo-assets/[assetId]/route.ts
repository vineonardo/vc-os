import { getDemoAssetFile } from "@/lib/demo-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { assetId: string } },
) {
  const file = await getDemoAssetFile(params.assetId).catch(() => null);
  if (!file) return Response.json({ error: "Asset not found." }, { status: 404 });

  return new Response(new Uint8Array(file.file_data), {
    headers: {
      "Content-Type": file.content_type,
      "Content-Disposition": `attachment; filename="${file.file_name.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
