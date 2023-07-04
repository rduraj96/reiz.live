import React from "react";
import AsciiEffectScene from "../(components)/Scene";

type Props = {};

const page = (props: Props) => {
  return (
    <div className="w-screen max-h-screen bg-foreground relative">
      <AsciiEffectScene />
      <h1 className="absolute top-3/4 left-1/2 text-gray-300">
        {"[COMING SOON]"}
      </h1>
    </div>
  );
};

export default page;
