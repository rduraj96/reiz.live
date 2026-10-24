import { describe, expect, it } from "vitest";
import { genres, START_GENRE } from "@/lib/catalog";

describe("genres", () => {
  it("are the sixteen dial bands, calm to energetic", () => {
    expect(genres.map((g) => g.value)).toEqual([
      "ambient", "lofi", "chillout", "classical", "jazz", "soul", "rnb", "hip-hop",
      "reggae", "indie", "rock", "metal", "pop", "80s", "house", "techno",
    ]);
    expect(genres.map((g) => g.label)).toEqual([
      "Ambient", "Lofi", "Chillout", "Classical", "Jazz", "Soul", "RnB", "Hip-Hop",
      "Reggae", "Indie", "Rock", "Metal", "Pop", "80s", "House", "Techno",
    ]);
  });

  it("the dial opens on House", () => {
    expect(START_GENRE).toBe("house");
    expect(genres.some((g) => g.value === START_GENRE)).toBe(true);
  });
});
