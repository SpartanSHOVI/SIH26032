'use client';

import dynamic from 'next/dynamic';

const AnnSetuApp = dynamic(() => import('../../App'), { ssr: false });

export default function CatchAll() {
  return <AnnSetuApp />;
}
