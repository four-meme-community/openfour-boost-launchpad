/**
 * Full-page token detail skeleton: mirror real card layout before token data,
 * avoiding a "loading" flash or layout jump.
 */
"use client";

import { Skeleton } from "@/components/skeleton";

export function TokenDetailSkeleton() {
	return (
		<section className="detail">
			<div className="detail-main">
				<div className="detail-chart-col">
					<header className="token-header token-header--identity">
						<div className="token-header-main">
							<Skeleton circle width={72} height={72} />
							<div className="token-header-identity">
								<Skeleton width={180} height="1.4rem" />
								<Skeleton width="70%" height="0.9rem" />
								<div className="token-meta-row">
									<Skeleton width={90} height="0.85rem" />
									<Skeleton width={110} height="0.85rem" />
								</div>
							</div>
							<div className="token-metrics token-metrics--compact">
								{Array.from({ length: 4 }).map((_, i) => (
									<div className="token-stat" key={i}>
										<Skeleton width="60%" height="0.7rem" />
										<Skeleton width="80%" height="0.95rem" />
									</div>
								))}
							</div>
						</div>
					</header>

					<section className="token-chart">
						<div className="chart-toolbar">
							<Skeleton width={120} height="1.4rem" />
							<Skeleton width={180} height="1.6rem" />
						</div>
						<div className="chart-shell">
							<Skeleton className="chart-skeleton" />
						</div>
					</section>

					<section className="token-below">
						<div className="token-below-tabs">
							<Skeleton width={70} height="2.2rem" />
							<Skeleton width={70} height="2.2rem" />
						</div>
						<div className="token-below-panel">
							{Array.from({ length: 5 }).map((_, i) => (
								<div className="fill-row" key={i}>
									<Skeleton width="80%" height="0.75rem" />
									<Skeleton width="70%" height="0.75rem" />
									<Skeleton width="60%" height="0.75rem" />
									<Skeleton width="75%" height="0.75rem" />
									<Skeleton width="65%" height="0.75rem" />
									<Skeleton width="65%" height="0.75rem" />
								</div>
							))}
						</div>
					</section>
				</div>

				<aside className="trade-docker">
					<div className="trade-docker-card">
						<section className="trade-panel">
							<Skeleton width={100} height="0.8rem" />
							<div className="trade-tabs">
								<Skeleton height={40} />
								<Skeleton height={40} />
							</div>
							<Skeleton height={48} />
							<div className="trade-pcts">
								{Array.from({ length: 4 }).map((_, i) => (
									<Skeleton key={i} height={32} />
								))}
							</div>
							<Skeleton height={44} />
						</section>
					</div>
					<section className="token-info-card">
						<Skeleton width={90} height="0.85rem" />
						<dl>
							{Array.from({ length: 5 }).map((_, i) => (
								<div key={i} style={{ display: "contents" }}>
									<dt>
										<Skeleton width="70%" height="0.72rem" />
									</dt>
									<dd>
										<Skeleton width="80%" height="0.72rem" />
									</dd>
								</div>
							))}
						</dl>
					</section>
				</aside>
			</div>
		</section>
	);
}
