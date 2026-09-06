import './globals.css'
export const metadata={title:'AI Film Studio',description:'AI-powered film production workspace'}
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
