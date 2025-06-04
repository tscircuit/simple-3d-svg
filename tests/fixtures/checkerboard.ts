export const CHECKER_2x2 =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAA" +
  "EklEQVR4nGP4//8/AwT8//8fACnkBftaqoeuAAAAAElFTkSuQmCC"

export const CHECKER_10x10 = `data:image/svg+xml;base64,${btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <rect width="200" height="200" fill="white"/>
  <g fill="black">
    <!-- Draw black squares -->
    <!-- Even rows: start at (0, y), skip every other square -->
    <!-- Odd rows: start at (20, y), skip every other square -->
    <!-- Each square is 20x20 -->
    <!-- Row 0 -->
    <rect x="0" y="0" width="20" height="20"/>
    <rect x="40" y="0" width="20" height="20"/>
    <rect x="80" y="0" width="20" height="20"/>
    <rect x="120" y="0" width="20" height="20"/>
    <rect x="160" y="0" width="20" height="20"/>
    <!-- Row 1 -->
    <rect x="20" y="20" width="20" height="20"/>
    <rect x="60" y="20" width="20" height="20"/>
    <rect x="100" y="20" width="20" height="20"/>
    <rect x="140" y="20" width="20" height="20"/>
    <rect x="180" y="20" width="20" height="20"/>
    <!-- Row 2 -->
    <rect x="0" y="40" width="20" height="20"/>
    <rect x="40" y="40" width="20" height="20"/>
    <rect x="80" y="40" width="20" height="20"/>
    <rect x="120" y="40" width="20" height="20"/>
    <rect x="160" y="40" width="20" height="20"/>
    <!-- Row 3 -->
    <rect x="20" y="60" width="20" height="20"/>
    <rect x="60" y="60" width="20" height="20"/>
    <rect x="100" y="60" width="20" height="20"/>
    <rect x="140" y="60" width="20" height="20"/>
    <rect x="180" y="60" width="20" height="20"/>
    <!-- Row 4 -->
    <rect x="0" y="80" width="20" height="20"/>
    <rect x="40" y="80" width="20" height="20"/>
    <rect x="80" y="80" width="20" height="20"/>
    <rect x="120" y="80" width="20" height="20"/>
    <rect x="160" y="80" width="20" height="20"/>
    <!-- Row 5 -->
    <rect x="20" y="100" width="20" height="20"/>
    <rect x="60" y="100" width="20" height="20"/>
    <rect x="100" y="100" width="20" height="20"/>
    <rect x="140" y="100" width="20" height="20"/>
    <rect x="180" y="100" width="20" height="20"/>
    <!-- Row 6 -->
    <rect x="0" y="120" width="20" height="20"/>
    <rect x="40" y="120" width="20" height="20"/>
    <rect x="80" y="120" width="20" height="20"/>
    <rect x="120" y="120" width="20" height="20"/>
    <rect x="160" y="120" width="20" height="20"/>
    <!-- Row 7 -->
    <rect x="20" y="140" width="20" height="20"/>
    <rect x="60" y="140" width="20" height="20"/>
    <rect x="100" y="140" width="20" height="20"/>
    <rect x="140" y="140" width="20" height="20"/>
    <rect x="180" y="140" width="20" height="20"/>
    <!-- Row 8 -->
    <rect x="0" y="160" width="20" height="20"/>
    <rect x="40" y="160" width="20" height="20"/>
    <rect x="80" y="160" width="20" height="20"/>
    <rect x="120" y="160" width="20" height="20"/>
    <rect x="160" y="160" width="20" height="20"/>
    <!-- Row 9 -->
    <rect x="20" y="180" width="20" height="20"/>
    <rect x="60" y="180" width="20" height="20"/>
    <rect x="100" y="180" width="20" height="20"/>
    <rect x="140" y="180" width="20" height="20"/>
    <rect x="180" y="180" width="20" height="20"/>
  </g>
</svg>
`,
)}`
