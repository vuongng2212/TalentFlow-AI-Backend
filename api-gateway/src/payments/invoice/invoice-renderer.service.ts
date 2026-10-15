import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface ReceiptRenderInput {
  invoiceReference: string;
  issuedAt: Date;
  issuer: { name: string; address: string };
  payer: { name: string };
  item: {
    code: string;
    description: string;
    quantity: number;
    termsVersion: string;
  };
  subtotalVnd: number;
  taxVnd: number;
  totalVnd: number;
  currency: string;
}

@Injectable()
export class InvoiceRendererService {
  render(input: ReceiptRenderInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({
        margin: 48,
        size: 'A4',
        info: {
          Title: `Payment receipt ${input.invoiceReference}`,
          Creator: 'TalentFlow AI',
          CreationDate: input.issuedAt,
        },
      });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.once('error', reject);
      document.once('end', () => resolve(Buffer.concat(chunks)));

      document.fontSize(22).text('PAYMENT RECEIPT');
      document.moveDown();
      document.fontSize(10).text(`Receipt: ${input.invoiceReference}`);
      document.text(`Issued: ${input.issuedAt.toISOString()}`);
      document.moveDown();
      document.fontSize(12).text('Issuer');
      document.fontSize(10).text(input.issuer.name);
      document.text(input.issuer.address);
      document.moveDown();
      document.fontSize(12).text('Payer');
      document.fontSize(10).text(input.payer.name);
      document.moveDown();
      document.fontSize(12).text('Item');
      document
        .fontSize(10)
        .text(`${input.item.description} (${input.item.code})`);
      document.text(
        `Quantity: ${input.item.quantity} | Terms: ${input.item.termsVersion}`,
      );
      document.moveDown();
      document.text(
        `Subtotal: ${input.subtotalVnd.toLocaleString('vi-VN')} ${input.currency}`,
      );
      document.text(
        `Tax: ${input.taxVnd.toLocaleString('vi-VN')} ${input.currency}`,
      );
      document
        .fontSize(12)
        .text(
          `Total paid: ${input.totalVnd.toLocaleString('vi-VN')} ${input.currency}`,
        );
      document.moveDown();
      document
        .fontSize(8)
        .text(
          'This is a commercial payment receipt, not a government-recognized electronic tax invoice.',
        );
      document.end();
    });
  }
}
