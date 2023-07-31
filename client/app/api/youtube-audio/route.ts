import { NextRequest, NextResponse } from "next/server";
import ytdl from "ytdl-core";
import ytpl from "ytpl";

export async function GET(request: NextRequest) {
  try {
    const playlistInfo = await ytpl(
      "OLAK5uy_l1x-JAx0w53suECoCI0YJtW6VB8DBQWRQ"
    );

    const playlist = await Promise.all(
      playlistInfo.items.map(async (item) => {
        try {
          const info = await ytdl.getInfo(item.id);
          // console.log(info);
          const audioFormats = ytdl.filterFormats(info.formats, "audioonly");
          console.log(audioFormats);
          return {
            title: item.title,
            url: audioFormats[0].url,
          };
        } catch (error) {
          console.log(error);
          return null;
        }
      })
    );

    return new NextResponse(JSON.stringify(playlist.filter(Boolean)), {
      status: 201,
    });
  } catch (error) {
    return new NextResponse("Failed to fetch audio stream", { status: 500 });
  }
}
