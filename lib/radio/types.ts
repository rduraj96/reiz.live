export type Station = {
  id: string;
  name: string;
  streamUrl: string;
  homepage: string | null;
  favicon: string | null;
  country: string;
  countryCode: string;
  language: string;
  tags: string[];
  codec: string;
  bitrate: number;
};

/** The subset of the Radio Browser station JSON that `normalize` reads. */
export type RawStation = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  country: string;
  countrycode: string;
  language: string;
  tags: string;
  codec: string;
  bitrate: number;
};
