// pdf-parse@1.1.1 ships no types. We import the lib subpath to avoid the package
// index.js debug block, so declare that subpath here.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdf(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdf;
}
