import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Upload, BarChart3, Home, Settings, TrendingUp } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-inbody-ice-gray/10">
      <nav className="border-b border-inbody-light-gray/30 bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold text-inbody-red flex items-center gap-2 hover:opacity-80 transition-opacity">
                <BarChart3 className="h-6 w-6" />
                Sales Dashboard
              </Link>
              <div className="flex gap-2">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="text-inbody-dark-gray hover:text-inbody-red hover:bg-inbody-red/10">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/upload">
                  <Button variant="ghost" size="sm" className="text-inbody-dark-gray hover:text-inbody-red hover:bg-inbody-red/10">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </Link>
                <Link href="/master-mapping">
                  <Button variant="ghost" size="sm" className="text-inbody-dark-gray hover:text-inbody-red hover:bg-inbody-red/10">
                    <Settings className="h-4 w-4 mr-2" />
                    Master Mapping
                  </Button>
                </Link>
                <Link href="/analysis">
                  <Button variant="ghost" size="sm" className="text-inbody-dark-gray hover:text-inbody-red hover:bg-inbody-red/10">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Analysis
                  </Button>
                </Link>
              </div>
            </div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-inbody-cool-gray hover:text-inbody-red hover:bg-inbody-red/10">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
