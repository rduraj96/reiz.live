export type RadioStation = {
  id?: string;
  name: string;
  url: string;
  urlResolved: string;
  favicon?: string;
  country: string;
  countryCode: string;
  language: string;
  tags: string[];
  bitrate: number;
  codec: string;
  homepage: string;
};
