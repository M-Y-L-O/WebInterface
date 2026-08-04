import type { Metadata } from "next";
import { Bakbak_One, Josefin_Sans } from "next/font/google";
import '@/lib/fontawesome/css/fa.css';
import "./globals.css";
import {Toaster} from 'sonner';

const joseSans = Josefin_Sans({
  variable: "--font-josefin-sans",
  subsets: ["latin"],
});

const bakbakOne = Bakbak_One({
  variable: "--font-bakbak",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "MYLO",
  description: "Visual Neural Network Studio",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${joseSans.variable} ${bakbakOne.variable} h-full antialiased`}
    >

      <body className="min-h-full flex flex-col">
      <Toaster theme={"dark"}/>
          {children}
      </body>
    </html>
  );
}
