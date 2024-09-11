import { ScrollArea } from "@/components/ui/scroll-area";
import * as React from "react";
import Image from "next/image";

type PhotoGridProps = {
  photos: Uint8Array[];
};

export const PhotoGrid: React.FC<PhotoGridProps> = ({ photos }) => {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <ScrollArea>
        <div
          style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}
        >
          {photos.map((photo, index) => (
            <Image
              key={index}
              width={100}
              height={100}
              style={{ margin: 5 }}
              src={`data:image/jpeg;base64,${Buffer.from(photo).toString(
                "base64"
              )}`}
              alt={`Photo ${index + 1}`}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
