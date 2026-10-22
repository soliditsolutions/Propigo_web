"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload, FileText, Loader2, Download, AlertCircle } from "lucide-react";
import { adjuntarAnexo, generarReconocimientoDeuda } from "./actions";
import { useToast } from "@/components/ui/toast";
import { fecha } from "@/lib/format";

interface Documento {
  id:         string;
  tipo:       string;
  nombre:     string;
  storageKey: string;
  createdAt:  Date;
}

interface Props {
  contratoId:       string;
  documentos:       Documento[];
  tieneDeuda:       boolean;
}

const TIPO_LABEL: Record<string, string> = {
  anexo:               "Anexo",
  reconocimiento_deuda: "Reconoc. deuda",
};

export function AnexosSection({ contratoId, documentos, tieneDeuda }: Props) {
  const router             = useRouter();
  const { show: toast }    = useToast();
  const fileInputRef       = useRef<HTMLInputElement>(null);
  const [isPending, start] = useTransition();
  const [isGenDeuda, startGenDeuda] = useTransition();
  const [nombre, setNombre]         = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!nombre.trim()) {
      setUploadError("Ingresa un nombre descriptivo antes de subir el archivo.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload?type=documentos", { method: "POST", body: fd });
      const json = await res.json() as { url?: string; error?: string };

      if (!res.ok || !json.url) {
        setUploadError(json.error ?? "Error al subir el archivo.");
        return;
      }

      start(async () => {
        const result = await adjuntarAnexo(contratoId, { nombre: nombre.trim(), storageKey: json.url! });
        if (!result.ok) {
          toast(result.error ?? "Error al adjuntar el anexo.", "error");
          return;
        }
        toast("Anexo adjuntado correctamente.", "success");
        setNombre("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      });
    } catch {
      setUploadError("Error de conexión al subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  function handleGenerarDeuda() {
    startGenDeuda(async () => {
      const res = await generarReconocimientoDeuda(contratoId);
      if (!res.ok) {
        toast(res.error ?? "Error al generar el documento.", "error");
        return;
      }
      toast("Reconocimiento de deuda generado.", "success");
      router.refresh();
    });
  }

  const isLoading   = isPending || uploading;
  const faltaNombre = !nombre.trim();
  const puedeSubir  = !isLoading && !faltaNombre;

  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl"
      style={{ background: "var(--pgo-surface)", border: "1px solid var(--pgo-border)", boxShadow: "var(--pgo-shadow)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--pgo-border)", background: "var(--pgo-surface-2)" }}
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>
          <Paperclip className="h-4 w-4" aria-hidden />
          Documentos adjuntos
        </h2>

        {tieneDeuda && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Estado de cuenta (L-CM1): el documento que respalda la monitoria. */}
            <a
              href={`/api/panel/contratos/${contratoId}/estado-cuenta/pdf`}
              className="pgo-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: "var(--pgo-surface-2)", color: "var(--pgo-text-2)", border: "1px solid var(--pgo-border-2)" }}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Estado de cuenta (PDF)
            </a>
            <button
              type="button"
              onClick={handleGenerarDeuda}
              disabled={isGenDeuda}
              className="pgo-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: isGenDeuda ? "var(--pgo-text-4)" : "var(--pgo-danger-dk)" }}
            >
              {isGenDeuda ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <FileText className="h-3.5 w-3.5" aria-hidden />
              )}
              Generar reconocimiento de deuda
            </button>
          </div>
        )}
      </div>

      {/* Lista de documentos */}
      {documentos.length > 0 ? (
        <div className="divide-y" style={{ borderColor: "var(--pgo-border)" }}>
          {documentos.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
              <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--pgo-text-4)" }} aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: "var(--pgo-text-1)" }}>
                  {doc.nombre}
                </p>
                <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
                  {TIPO_LABEL[doc.tipo] ?? doc.tipo} · {fecha(doc.createdAt)}
                </p>
              </div>
              <a
                href={`/api/documentos/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pgo-btn inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--pgo-surface-2)]"
                style={{ color: "var(--pgo-primary)" }}
                aria-label={`Descargar ${doc.nombre}`}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Abrir
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-4 text-sm" style={{ color: "var(--pgo-text-4)" }}>
          Sin documentos adjuntos.
        </div>
      )}

      {/* Formulario para subir anexo */}
      <div
        className="px-5 py-4 space-y-3"
        style={{ borderTop: "1px solid var(--pgo-border)", background: "var(--pgo-surface-2)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>
          Adjuntar nuevo anexo (PDF, máx. 10 MB)
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={nombre}
            onChange={(e) => { setNombre(e.target.value); setUploadError(null); }}
            placeholder="Nombre descriptivo del documento…"
            className="min-w-[220px] flex-1 rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--pgo-border)", color: "var(--pgo-text-1)", background: "var(--pgo-surface)" }}
            maxLength={120}
          />
          {/* El botón se deshabilita mientras falte el nombre. Antes siempre
              se veía activo: el usuario lo apretaba, navegaba su disco, elegía
              el PDF y RECIÉN ahí aparecía "ingresa un nombre" — descartando la
              selección. Se reportó como "no se pueden adjuntar documentos". */}
          <label
            htmlFor={puedeSubir ? "anexo-file-input" : undefined}
            aria-disabled={!puedeSubir || undefined}
            title={faltaNombre ? "Primero escribe un nombre para el documento" : undefined}
            className={`pgo-btn inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold text-white ${
              puedeSubir ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
            style={{ background: puedeSubir ? "var(--pgo-primary)" : "var(--pgo-text-4)" }}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            {uploading ? "Subiendo…" : isPending ? "Guardando…" : "Subir PDF"}
            <input
              id="anexo-file-input"
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={!puedeSubir}
              onChange={handleUpload}
              aria-label="Seleccionar archivo PDF para adjuntar"
            />
          </label>
        </div>

        {/* Pista, no error: el usuario todavía no hizo nada mal. Explica por
            qué el botón está apagado antes de que lo intente. */}
        {faltaNombre && !uploadError && (
          <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
            Escribe un nombre para habilitar la carga.
          </p>
        )}

        {uploadError && (
          <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--pgo-danger-dk)" }}>
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {uploadError}
          </p>
        )}
      </div>
    </div>
  );
}
