/**
 * Skeleton primitive: keep real layout classes (table/row/grid) for size,
 * swap text/images for pulsing gray blocks so content swap does not jump.
 */

export function Skeleton({
	width,
	height = "1em",
	circle = false,
	className = "",
}: {
	width?: number | string;
	height?: number | string;
	circle?: boolean;
	className?: string;
}) {
	return (
		<span
			className={`skeleton${circle ? " skeleton-circle" : ""}${
				className ? ` ${className}` : ""
			}`}
			style={{ width, height }}
			aria-hidden
		/>
	);
}
