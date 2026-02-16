import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, BarChart3, Database, TrendingUp, Globe2, FileSpreadsheet, Layers } from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: Upload,
      title: 'Easy Data Upload',
      description: 'Excel 파일을 드래그 앤 드롭으로 간편하게 업로드하고 컬럼 매핑을 저장하세요',
    },
    {
      icon: Database,
      title: 'Centralized Data',
      description: '전 세계 16개 법인의 매출 데이터를 하나의 통합 플랫폼에서 관리',
    },
    {
      icon: BarChart3,
      title: 'Rich Visualizations',
      description: '월별 트렌드, 분기 비교, 제품별 순위 등 다양한 차트로 시각화',
    },
    {
      icon: TrendingUp,
      title: 'Real-time Insights',
      description: '엔티티, 연도, 분기, 카테고리 등 강력한 필터링으로 즉시 인사이트 확인',
    },
  ];

  const stats = [
    {
      icon: Globe2,
      label: 'Global Entities',
      value: '16',
      description: 'HQ, USA, BWA, Vietnam, Healthcare, Korot, Japan, China, India, Mexico, Oceania, Netherlands, Germany, UK, Asia, Europe',
    },
    {
      icon: FileSpreadsheet,
      label: 'Data Sources',
      value: '3',
      description: 'Excel Upload, Item Mapping, Exchange Rate Management',
    },
    {
      icon: Layers,
      label: 'Dashboards',
      value: '2',
      description: 'Individual Entity Dashboard & InBody Group Dashboard',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-inbody-ice-gray/20">
      <div className="container mx-auto px-4 py-16 md:py-24">
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-20">
          <div className="inline-block">
            <div className="flex items-center justify-center gap-2 mb-4">
              <BarChart3 className="h-12 w-12 text-inbody-red" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-inbody-red to-inbody-red/60">
            Sales Dashboard
          </h1>
          <p className="text-xl md:text-2xl text-inbody-dark-gray max-w-3xl mx-auto leading-relaxed">
            통합 매출 분석 대시보드 - InBody 글로벌 자회사 매출 데이터를 한 곳에서 관리하고 분석하세요
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid gap-6 md:grid-cols-3 mb-20">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-2 border-inbody-light-gray/30 hover:border-inbody-red/50 hover:shadow-lg transition-all bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-2">
                  <div className="rounded-full bg-inbody-red/10 w-16 h-16 flex items-center justify-center mx-auto mb-3">
                    <Icon className="h-8 w-8 text-inbody-red" />
                  </div>
                  <div className="text-4xl font-bold text-inbody-red mb-2">{stat.value}</div>
                  <CardTitle className="text-lg text-inbody-black">{stat.label}</CardTitle>
                  <CardDescription className="text-xs pt-2 text-inbody-cool-gray">{stat.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Features Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-2 text-inbody-black">주요 기능</h2>
          <div className="h-1 w-20 bg-gradient-to-r from-inbody-red to-inbody-red/40 mx-auto mb-10 rounded-full"></div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="hover:shadow-xl hover:-translate-y-1 transition-all border-inbody-light-gray/20 bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="rounded-lg bg-inbody-red/10 w-fit p-3 mb-3">
                      <Icon className="h-6 w-6 text-inbody-red" />
                    </div>
                    <CardTitle className="text-lg text-inbody-black">{feature.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed text-inbody-cool-gray">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Link href="/upload">
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base bg-inbody-red hover:bg-inbody-red/90 text-white shadow-lg hover:shadow-xl transition-all">
              <Upload className="h-5 w-5 mr-2" />
              Upload Data
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base border-2 border-inbody-red text-inbody-red hover:bg-inbody-red hover:text-white transition-all">
              <BarChart3 className="h-5 w-5 mr-2" />
              View Dashboard
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-20 pt-8 border-t border-inbody-light-gray/30 text-center">
          <p className="text-sm text-inbody-cool-gray mb-2">
            Built with Next.js 14, React 18, Tailwind CSS, Supabase
          </p>
          <p className="text-xs text-inbody-cool-gray">
            © 2026 InBody Co., Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
