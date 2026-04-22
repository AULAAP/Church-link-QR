import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route for sending bulk emails
  app.post('/api/send-bulk-emails', async (req, res) => {
    const { churches, smtpConfig, emailTemplate } = req.body;

    if (!churches || !Array.isArray(churches)) {
      return res.status(400).json({ error: 'Lista de iglesias no válida' });
    }

    // SMTP Configuration
    // Use user-provided config or environment variables
    const transporter = nodemailer.createTransport({
      host: smtpConfig?.host || process.env.SMTP_HOST,
      port: Number(smtpConfig?.port) || Number(process.env.SMTP_PORT) || 587,
      secure: smtpConfig?.secure ?? process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpConfig?.user || process.env.SMTP_USER,
        pass: smtpConfig?.pass || process.env.SMTP_PASS,
      },
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    try {
      // Test connection
      await transporter.verify();
    } catch (error: any) {
      return res.status(500).json({ error: `Error de conexión SMTP: ${error.message}` });
    }

    for (const church of churches) {
      if (!church.email || !church.email.includes('@')) {
        results.failed++;
        results.errors.push(`Iglesia ${church.name}: Correo no válido`);
        continue;
      }

      try {
        // Generate QR code as a buffer for the attachment
        const qrBuffer = await QRCode.toBuffer(church.id, {
          width: 512,
          margin: 2,
          color: {
            dark: '#1D4ED8', // Blue 700 to match UI
            light: '#FFFFFF',
          },
        });

        const mailOptions = {
          from: smtpConfig?.from || process.env.SMTP_FROM || `"Distribución de Libros" <${process.env.SMTP_USER}>`,
          to: church.email,
          subject: emailTemplate?.subject || `Código QR para Entrega - ${church.name}`,
          html: (emailTemplate?.html || `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #2563EB; padding: 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 20px;">ENTREGA DE MATERIALES</h1>
              </div>
              <div style="padding: 30px; text-align: center;">
                <p>Hola <strong>{{responsible}}</strong>,</p>
                <p>Adjunto encontrará el código QR correspondiente a la iglesia <strong>{{churchName}}</strong>.</p>
                <div style="margin: 30px 0;">
                  <img src="cid:qrcode" alt="Código QR" style="width: 200px; height: 200px; border: 4px solid #f1f5f9; border-radius: 12px;" />
                </div>
                <div style="background-color: #F8FAFC; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                  <p style="margin: 0; font-size: 14px; font-weight: bold; color: #1E293B;">ID ÚNICO: <span style="font-family: monospace; letter-spacing: 2px;">{{id}}</span></p>
                </div>
                <p style="font-size: 14px; color: #64748B;">Por favor, presente este código en el puesto de entrega para recibir sus materiales.</p>
              </div>
              <div style="background-color: #F8FAFC; padding: 15px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #e2e8f0;">
                Sistema de Seguimiento ChurchLink
              </div>
            </div>
          `)
          .replace(/{{churchName}}/g, church.name)
          .replace(/{{responsible}}/g, church.responsible)
          .replace(/{{id}}/g, church.id),
          attachments: [
            {
              filename: `QR_${church.id}.png`,
              content: qrBuffer,
              cid: 'qrcode', // same as in the html img src
            },
          ],
        };

        await transporter.sendMail(mailOptions);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Error enviando a ${church.name}: ${error.message}`);
      }
    }

    res.json(results);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
