/**
 * Full-page tax detail skeleton: mirror real cards (`tax-header`/`tax-card`/
 * `tax-facts`/side dividend panel) so there is no "loading" flash or layout jump.
 * Same approach as `components/token-detail-skeleton.tsx`.
 */
"use client";

import { Skeleton } from "@/components/skeleton";

export function TokenTaxSkeleton() {
	return (
		<div className="tax-page-grid">
			<section className="tax-page">
				<div className="tax-header">
					<Skeleton circle width={56} height={56} />
					<div className="tax-header-identity">
						<Skeleton width={160} height="1.2rem" />
						<Skeleton width="80%" height="0.85rem" />
					</div>
					<div className="tax-header-rates">
						<div className="tax-rate-stat">
							<Skeleton width={60} height="0.72rem" />
							<Skeleton width={44} height="1.3rem" />
						</div>
						<div className="tax-rate-stat">
							<Skeleton width={60} height="0.72rem" />
							<Skeleton width={44} height="1.3rem" />
						</div>
					</div>
				</div>

				<div className="card tax-card">
					<Skeleton width={110} height="0.85rem" />
					<Skeleton height={10} />
					<div className="tax-allocation-legend">
						{Array.from({ length: 2 }).map((_, i) => (
							<div className="tax-allocation-legend-item" key={i}>
								<Skeleton width="70%" height="0.8rem" />
							</div>
						))}
					</div>
					<dl className="tax-facts">
						{Array.from({ length: 2 }).map((_, i) => (
							<div key={i} style={{ display: "contents" }}>
								<dt>
									<Skeleton width="60%" height="0.75rem" />
								</dt>
								<dd>
									<Skeleton width="50%" height="0.75rem" />
								</dd>
							</div>
						))}
					</dl>
				</div>

				<div className="card tax-card">
					<Skeleton width={100} height="0.85rem" />
					<div className="tax-position-stats">
						{Array.from({ length: 3 }).map((_, i) => (
							<div className="tax-position-stat" key={i}>
								<Skeleton width={70} height="0.72rem" />
								<Skeleton width={90} height="1.1rem" />
							</div>
						))}
					</div>
					<Skeleton height={40} width={160} />
				</div>

				<div className="card tax-card">
					<Skeleton width={110} height="0.85rem" />
					<Skeleton width="60%" height="0.8rem" />
				</div>
			</section>

			<aside className="tax-page-side">
				<div className="card tax-card">
					<Skeleton width={90} height="0.85rem" />
					<Skeleton width="90%" height="0.78rem" />
					<div className="dividends-empty">
						<Skeleton width="70%" height="0.85rem" />
					</div>
				</div>
			</aside>
		</div>
	);
}
