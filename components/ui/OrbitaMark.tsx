/**
 * Símbolo ÓRBITA: duas peças triangulares derivadas do caractere ◢
 * (right-filled triangle), deslocadas diagonalmente. A peça neutra (parada)
 * representa a origem; a peça em Tangerine Tango representa o movimento em
 * direção ao destino. Não é um pin de mapa genérico — é a unidade
 * geométrica base da linguagem visual do ÓRBITA, usada como assinatura
 * discreta ao lado do nome do produto.
 */
export function OrbitaMark({
  size = 20,
  variant = "default",
  className,
}: {
  size?: number;
  variant?: "default" | "inverted";
  className?: string;
}) {
  const neutral = variant === "inverted" ? "#E5E3D2" : "#161616";
  const accent = "#FF5B19";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* origem — peça estática */}
      <polygon points="3,3 17,3 3,17" fill={neutral} />
      {/* movimento/destino — peça em Tangerine Tango, deslocada */}
      <polygon points="11,11 25,11 25,25" fill={accent} />
    </svg>
  );
}
