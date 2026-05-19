export type Screen = "login" | "home" | "events" | "scan" | "wallet" | "purchase" | "account";

export type EventItem = {
  id: string;
  date: string;
  title: string;
  points: number;
  location: string;
  time: string;
};

export type ProductCategory = {
  id: string;
  name: string;
  products: string[];
};

export const user = {
  accountType: "地域住民",
  userId: "aiueokakikukeko",
  email: "sample@gmail.com",
  homePoints: 1234,
  walletPoints: 1200,
};

export const scheduledEvent: EventItem = {
  id: "scheduled",
  date: "YYYY/MM/DD",
  title: "〇〇市の防災活動　ご家族での参加もOK！",
  points: 100,
  location: "〇〇市",
  time: "10:00~12:00",
};

export const events: EventItem[] = [
  {
    id: "clean",
    date: "YYYY/MM/DD",
    title: "〇〇公園の清掃ボランティア　どなたでも大歓迎！",
    points: 60,
    location: "〇〇公園",
    time: "16:00~17:30",
  },
  {
    id: "towel",
    date: "YYYY/MM/DD",
    title: "手縫いタオル制作　初心者でも大丈夫！",
    points: 300,
    location: "〇〇施設",
    time: "13:00~15:30",
  },
  {
    id: "stamp",
    date: "YYYY/MM/DD",
    title: "〇〇イベントの記念スタンプ募集",
    points: 100,
    location: "商店街",
    time: "11:00~15:00",
  },
];

export const productCategories: ProductCategory[] = [
  { id: "popular", name: "商店街の人気商品", products: ["人気商品A", "人気商品B", "人気商品C", "人気商品D"] },
  { id: "souvenir", name: "おみやげ", products: ["おみやげA", "おみやげB", "おみやげC"] },
  { id: "life", name: "生活応援商品", products: ["生活用品A", "生活用品B", "生活用品C"] },
];
