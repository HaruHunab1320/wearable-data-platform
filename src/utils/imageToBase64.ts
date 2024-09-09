import * as fs from "fs";

export function imageToBase64(path: string) {
  console.log("PATH", path);
  const image = fs.readFileSync(path, { encoding: "base64" });
  console.log("IMAGE", image);
  console.log("return", `data:image/jpeg;base64,${image}`);
  return `data:image/jpeg;base64,${image}`; // Adjust the MIME type if necessary (e.g., image/png)
}
