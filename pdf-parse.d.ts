declare module "pdf-parse/lib/pdf-parse.js" {
    import { Buffer } from "buffer";
  
    interface PDFData {
      text: string;
      numpages: number;
      numrender: number;
      info: any;
      metadata: any;
      version: string;
    }
  
    function pdf(dataBuffer: Buffer, options?: any): Promise<PDFData>;
    export default pdf;
  }