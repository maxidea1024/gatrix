import React, { type ReactNode } from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import Translate from '@docusaurus/Translate';

import styles from './index.module.css';

function HeroBanner() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <div className={styles.hero}>
      <div className={styles.heroInner}>
        <Heading as="h1" className={styles.heroTitle}>
          <img
            alt="Gatrix Logo"
            className={styles.heroLogo}
            src={useBaseUrl('/img/logo.svg')}
            width="120"
            height="120"
          />
          <span className={styles.heroTitleText}>
            <Translate id="homepage.welcome">Welcome to</Translate> <b>{siteConfig.title}</b>
          </span>
        </Heading>
        <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
        <div className={styles.heroCtas}>
          <Link to="/intro" className={styles.ctaCard}>
            <div className={styles.ctaCardContent}>
              <span className={styles.ctaIcon}>📖</span>
              <Translate id="homepage.cta.docs">Documentation</Translate>
            </div>
          </Link>
          <Link to="/getting-started/quick-start" className={styles.ctaCard}>
            <div className={styles.ctaCardContent}>
              <span className={styles.ctaIcon}>🚀</span>
              <Translate id="homepage.cta.quickstart">Quick Start</Translate>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

type FeatureItem = {
  titleId: string;
  titleDefault: string;
  descriptionId: string;
  descriptionDefault: string;
  icon: string;
  link: string;
};

const FeatureList: FeatureItem[] = [
  {
    titleId: 'homepage.feature.flags.title',
    titleDefault: 'Feature Flags',
    descriptionId: 'homepage.feature.flags.desc',
    descriptionDefault: 'Control features in real-time without code deployment',
    icon: '🚀',
    link: '/features/feature-flags',
  },
  {
    titleId: 'homepage.feature.gameops.title',
    titleDefault: 'Game Operations',
    descriptionId: 'homepage.feature.gameops.desc',
    descriptionDefault: 'Notices, coupons, surveys, banners and more',
    icon: '🎮',
    link: '/guide/service-notices',
  },
  {
    titleId: 'homepage.feature.integrations.title',
    titleDefault: 'Integrations',
    descriptionId: 'homepage.feature.integrations.desc',
    descriptionDefault: 'Slack, Teams, Webhook, New Relic and more',
    icon: '🔗',
    link: '/integrations/overview',
  },
  {
    titleId: 'homepage.feature.monitoring.title',
    titleDefault: 'Monitoring',
    descriptionId: 'homepage.feature.monitoring.desc',
    descriptionDefault: 'Event analytics, Grafana dashboards, audit logs',
    icon: '📊',
    link: '/api/client-api',
  },
];

function FeatureCard({
  titleId,
  titleDefault,
  descriptionId,
  descriptionDefault,
  icon,
  link,
}: FeatureItem) {
  return (
    <Link to={link} className={styles.featureCard}>
      <div className={styles.featureIcon}>{icon}</div>
      <Heading as="h3" className={styles.featureTitle}>
        <Translate id={titleId}>{titleDefault}</Translate>
      </Heading>
      <p className={styles.featureDesc}>
        <Translate id={descriptionId}>{descriptionDefault}</Translate>
      </p>
    </Link>
  );
}

function Features(): ReactNode {
  return (
    <div className={styles.features}>
      <div className={styles.featuresInner}>
        <Heading as="h2" className={styles.sectionTitle}>
          <Translate id="homepage.features.title">Core Features</Translate>
        </Heading>
        <div className={styles.featureGrid}>
          {FeatureList.map((props, idx) => (
            <FeatureCard key={idx} {...props} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HeroBanner />
      <Features />
    </Layout>
  );
}
