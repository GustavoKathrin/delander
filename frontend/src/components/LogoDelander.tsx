/**
 * Marca Delander desenhada em vetor: escala sem borrar e funciona tanto na
 * chapa escura quanto no fundo claro. O monograma e o "DL" do logo original.
 */
export function LogoDelander({
  altura = 28,
  variante = 'escuro',
  comAssinatura = true,
  className,
}: {
  altura?: number
  /** 'escuro' = fundo escuro (letras brancas); 'claro' = fundo claro (letras pretas). */
  variante?: 'claro' | 'escuro'
  comAssinatura?: boolean
  className?: string
}) {
  const azul = '#2323ee'
  const tinta = variante === 'escuro' ? '#ffffff' : '#0b0b0f'
  const largura = (altura * 450) / 100

  return (
    <svg
      viewBox="0 0 450 100"
      height={altura}
      width={largura}
      className={className}
      role="img"
      aria-label="Delander Auto Car"
    >
      <title>Delander Auto Car</title>

      {/* monograma DL */}
      <g>
        <path
          d="M18 8 h44 c22 0 36 16 36 42 0 26 -14 42 -36 42 h-44 z"
          fill={azul}
          transform="skewX(-10) translate(9 0)"
        />
        <path d="M44 26 h15 v34 h20 v14 h-35 z" fill="#ffffff" transform="skewX(-10) translate(9 0)" />
      </g>

      {/* DELANDER */}
      <text
        x="118"
        y="62"
        fill={tinta}
        fontFamily="Archivo, Inter, sans-serif"
        fontSize="58"
        fontWeight="800"
        fontStyle="italic"
        letterSpacing="-1"
      >
        DELANDER
      </text>

      {/* AUTO CAR */}
      {comAssinatura && (
        <text
          x="124"
          y="88"
          fill={azul}
          fontFamily="Archivo, Inter, sans-serif"
          fontSize="22"
          fontWeight="600"
          fontStyle="italic"
          letterSpacing="7"
        >
          AUTO CAR
        </text>
      )}
    </svg>
  )
}

/** Só o monograma, para espaços apertados (favicon, menu recolhido). */
export function MarcaDelander({ tamanho = 28, className }: { tamanho?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 110 100"
      width={tamanho}
      height={tamanho}
      className={className}
      role="img"
      aria-label="Delander"
    >
      <path
        d="M18 8 h44 c22 0 36 16 36 42 0 26 -14 42 -36 42 h-44 z"
        fill="#2323ee"
        transform="skewX(-10) translate(9 0)"
      />
      <path d="M44 26 h15 v34 h20 v14 h-35 z" fill="#ffffff" transform="skewX(-10) translate(9 0)" />
    </svg>
  )
}
