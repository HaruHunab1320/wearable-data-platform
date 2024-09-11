import { useState, useEffect } from "react";
import { PhotoGrid } from "./PhotoGrid";

export default function Home() {
  const [photos, setPhotos] = useState<Uint8Array[]>([]);

  useEffect(() => {
    // Fetch photos from the backend
    fetch(`/api/getPhotos?start=${0}&end=${Date.now()}`)
      .then((response) => response.json())
      .then((data) => setPhotos(data));
  }, []);

  return (
    <div>
      <PhotoGrid photos={photos} />
    </div>
  );
}
