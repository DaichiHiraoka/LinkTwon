export type Screen =
  | "login"
  | "home"
  | "events"
  | "scan"
  | "wallet"
  | "purchase"
  | "account"
  | "notifications"
  | "support"
  | "payment-methods"
  | "history";

export type EventItem = {
  id: string;
  date: string;
  title: string;
  points: number;
  location: string;
  time: string;
  description?: string;
  activity?: string;
  notes?: string;
  imageUrl?: string;
};

export type ProductCategory = {
  id: string;
  name: string;
  products: ProductItem[];
};

export type ProductItem = {
  id: string;
  name: string;
  storeName: string;
  storeAddress: string;
  mapQuery: string;
  description?: string;
  requiredPoints?: number;
  imageUrl?: string;
  favorited?: boolean;
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
  {
    id: "1",
    name: "商店街の人気商品",
    products: [
      {
        id: "1001",
        name: "人気商品A",
        storeName: "Link Cafe",
        storeAddress: "東京都千代田区丸の内1丁目",
        mapQuery: "Link Cafe 東京都千代田区丸の内1丁目",
        requiredPoints: 120,
      },
      {
        id: "1002",
        name: "人気商品B",
        storeName: "まちのパン屋",
        storeAddress: "東京都千代田区有楽町1丁目",
        mapQuery: "まちのパン屋 東京都千代田区有楽町1丁目",
        requiredPoints: 180,
      },
      {
        id: "1003",
        name: "人気商品C",
        storeName: "地域マルシェ",
        storeAddress: "東京都千代田区日比谷公園",
        mapQuery: "地域マルシェ 東京都千代田区日比谷公園",
        requiredPoints: 220,
      },
      {
        id: "1004",
        name: "人気商品D",
        storeName: "Link Cafe",
        storeAddress: "東京都千代田区丸の内1丁目",
        mapQuery: "Link Cafe 東京都千代田区丸の内1丁目",
        requiredPoints: 150,
      },
    ],
  },
  {
    id: "2",
    name: "おみやげ",
    products: [
      {
        id: "2001",
        name: "おみやげA",
        storeName: "地域マルシェ",
        storeAddress: "東京都千代田区日比谷公園",
        mapQuery: "地域マルシェ 東京都千代田区日比谷公園",
        requiredPoints: 220,
      },
      {
        id: "2002",
        name: "おみやげB",
        storeName: "まちのパン屋",
        storeAddress: "東京都千代田区有楽町1丁目",
        mapQuery: "まちのパン屋 東京都千代田区有楽町1丁目",
        requiredPoints: 150,
      },
      {
        id: "2003",
        name: "おみやげC",
        storeName: "Link Cafe",
        storeAddress: "東京都千代田区丸の内1丁目",
        mapQuery: "Link Cafe 東京都千代田区丸の内1丁目",
        requiredPoints: 180,
      },
    ],
  },
  {
    id: "3",
    name: "生活応援商品",
    products: [
      {
        id: "3001",
        name: "生活用品A",
        storeName: "地域マルシェ",
        storeAddress: "東京都千代田区日比谷公園",
        mapQuery: "地域マルシェ 東京都千代田区日比谷公園",
        requiredPoints: 220,
      },
      {
        id: "3002",
        name: "生活用品B",
        storeName: "Link Cafe",
        storeAddress: "東京都千代田区丸の内1丁目",
        mapQuery: "Link Cafe 東京都千代田区丸の内1丁目",
        requiredPoints: 120,
      },
      {
        id: "3003",
        name: "生活用品C",
        storeName: "まちのパン屋",
        storeAddress: "東京都千代田区有楽町1丁目",
        mapQuery: "まちのパン屋 東京都千代田区有楽町1丁目",
        requiredPoints: 150,
      },
    ],
  },
];
