/**
 * Fallback chapter data for courses 1 and 6
 * Used when Supabase and GAS are empty/unreachable
 */
import type { Chapter } from './utils/chapters';

// =============================================
// COURSE 1: Thiết kế website với Wordpress
// 1 chapter, 14 lessons
// =============================================
const COURSE_1_CHAPTERS: Chapter[] = [
  {
    id: 'ch-1772094592657',
    title: 'WEBSITE',
    lessons: [
      { id: 'ls-1772103602857', title: 'LÀM WEB CĂN BẢN: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/da7acb2a-f48f-4754-95f0-a6ebeba6410e', thumbnail: '' },
      { id: 'ls-1772103638810', title: 'LÀM WEB CĂN BẢN: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/b6f6c634-89e2-485f-b091-29264a6899ff', thumbnail: '' },
      { id: 'ls-1772102650727', title: 'CÀI DOMAIN LÊN HOSTING', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/8228d7b4-3d49-4040-b344-c66afb9a7e93', thumbnail: '' },
      { id: 'ls-1772102685406', title: 'CÀI ĐẶT CẤU HÌNH DNS TRÊN HOSTING', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/809dffc5-1918-458e-af3b-e0ff792dd621', thumbnail: '' },
      { id: 'ls-1772102698942', title: 'CÀI ĐẶT WP LÊN HOSTING', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/71acadd9-b714-47a5-b2ff-2995d460e688', thumbnail: '' },
      { id: 'ls-1772102725416', title: 'CÀI ĐẶT BẢO MẬT WP TRÊN HOSTING', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/27339eaf-e3ec-4aec-abc0-4e76be124373', thumbnail: '' },
      { id: 'ls-1772102741879', title: 'CÀI ĐẶT BẢO MẬT TRÊN WB', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/6d365656-d357-40b3-95bc-f2b23bca758a', thumbnail: '' },
      { id: 'ls-1772102759799', title: 'CÀI ĐẶT TỔNG QUAN WP', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/c5a4a41e-fd31-4b2d-9845-3a7ae9bc514e', thumbnail: '' },
      { id: 'ls-1772102798504', title: 'CÀI ĐẶT GIAO DIỆN WEBSITE', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/ebd52ce6-36c6-4cea-9434-66f68563550d', thumbnail: '' },
      { id: 'ls-1772102831288', title: 'CHỈNH SỬA GIAO DIỆN CUSTUMIZE WEBSITE', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/15efc29e-9b9d-44e6-8fb1-544e9e9eeb3b', thumbnail: '' },
      { id: 'ls-1772102853233', title: 'VIẾT BÀI POST TRÊN WEBSITE', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/67001ace-6229-40b1-b81a-bbae34bc7a6d', thumbnail: '' },
      { id: 'ls-1772102881601', title: 'TẠO THƯ MỤC CATEGORIES VÀ PAGE', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/65bafe82-af16-4159-9d68-5b3d5d05b5ea', thumbnail: '' },
      { id: 'ls-1772103340702', title: 'CÀI CHỐNG SPAM CHO WEB', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/10cd9244-b82c-4b98-8daa-888dd8a01a78', thumbnail: '' },
      { id: 'ls-1772174839596', title: 'HƯỚNG DẪN CÀI WORD PRESS', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/play/607264/29bb66ca-ecf5-44fa-af88-5f718c2c15ab', thumbnail: '' },
    ],
  },
];

// =============================================
// COURSE 6: Khởi nghiệp kiếm tiền với Youtube
// 15 chapters, 123+ lessons
// =============================================
const COURSE_6_CHAPTERS: Chapter[] = [
  // Chapter 0: KIẾM TIỀN YTB
  {
    id: 'ch-1772017757134',
    title: 'KIẾM TIỀN YTB',
    lessons: [
      { id: 'ls-1772020104209', title: 'MỞ ĐẦU', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/3fdce1be-91a0-47cd-bb1a-268778310872', thumbnail: '' },
      { id: 'ls-1772018967434', title: 'TƯ DUY 1%', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/d4d1e0d6-adb7-4e46-abc2-f3eaf71cd34a', thumbnail: '' },
      { id: 'ls-1772018926903', title: 'MỤC TIÊU TÀI CHÍNH SMART', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/c9ecbada-e64d-4e1d-bac3-992c61ab1bb9', thumbnail: '' },
      { id: 'ls-1772019298121', title: 'TIÊU CHÍ', duration: '02:13', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/3f888a2a-8cfd-4e42-b59d-38ddfa03dbc1', thumbnail: '' },
      { id: 'ls-1772019362649', title: 'KHÁN GIẢ', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/f227362a-63f1-4b3d-8232-537d8d819644', thumbnail: '' },
      { id: 'ls-1772019553035', title: 'INSIGN: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/680b2f46-49d1-46ae-843b-38a5d05e468a', thumbnail: '' },
      { id: 'ls-1772019585665', title: 'INSIGN: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/3dfe683b-12c4-4ffa-ba65-a82a347d91e7', thumbnail: '' },
      { id: 'ls-1772019878004', title: 'JET LAG', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/98e6d825-7e9a-4d56-8cfa-499fe187d48b', thumbnail: '' },
      { id: 'ls-1772019932688', title: 'SWIPE', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/fdc0bf07-2f07-404b-a7cd-a94477972830', thumbnail: '' },
      { id: 'ls-1772020188344', title: 'KÊNH MẪU', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/edc356df-325e-4a6c-b5f0-aabff3df953d', thumbnail: '' },
      { id: 'ls-1772070441901', title: 'SHU HA RI', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/4de3cc24-a0b6-40e5-80b0-3b502d48345f', thumbnail: '' },
      { id: 'ls-1772070474340', title: 'MUACHUNGTOOL', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/7a894972-f567-4c50-a822-feea419a43da', thumbnail: '' },
      { id: 'ls-1772070543338', title: 'BẬT KIẾM TIỀN', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/d7398b5b-cc23-4856-a012-587270b33636', thumbnail: '' },
      { id: 'ls-1772070593426', title: 'KEY', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/1f1125f1-278a-493d-9e27-875745d75388', thumbnail: '' },
      { id: 'ls-1772070697419', title: 'TOOL', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/41a529b2-c49e-437a-8672-3f01a2a30d1a', thumbnail: '' },
      { id: 'ls-1772070800114', title: 'TOOL AI', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/720afe0b-7352-4513-9621-6fd2c8511f4d', thumbnail: '' },
      { id: 'ls-1772071084562', title: '4 KEY - VIDEO', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/20a6547d-90a7-4953-a311-864390d7a801', thumbnail: '' },
      { id: 'ls-1772071120113', title: 'CHỦ ĐỀ', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/385843f3-973a-4c2e-b036-5e949b3400ab', thumbnail: '' },
      { id: 'ls-1772071218589', title: 'QUY TRÌNH TÌM KEY: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/d76e5fed-efcb-44a7-96c5-210667e1ba8d', thumbnail: '' },
      { id: 'ls-1772071307260', title: 'QUY TRÌNH TÌM KEY: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/cb08c263-122f-4ce1-b765-4288d532ded9', thumbnail: '' },
      { id: 'ls-1772071317107', title: 'QUY TRÌNH TÌM KEY: P3 - 1OF10', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/1dc5b14f-1236-4551-82aa-4af0b5e5b158', thumbnail: '' },
      { id: 'ls-1772071328627', title: 'QUY TRÌNH TÌM KEY: P4 - NEXLEV', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/23967db5-f3ed-4973-8d06-4ef270a164dd', thumbnail: '' },
    ],
  },
  // Chapter 1: THIẾT LẬP KÊNH
  {
    id: 'ch-1772089496774',
    title: 'THIẾT LẬP KÊNH',
    lessons: [
      { id: 'ls-1772075578246', title: 'TỐI ƯU KÊNH', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/b20f4a3d-5fc9-4b34-a44c-7d830c8b8a4c', thumbnail: '' },
      { id: 'ls-1772008891759', title: 'CHÍNH SÁCH CỦA YOUTUBE', duration: '09:06', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/74199b8f-ce2f-46a1-9980-ccc8c76f7909', thumbnail: '' },
      { id: 'ls-1772006143562', title: 'LƯU Ý KHI TẠO KÊNH YOUTUBE', duration: '08:58', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/ae0c612c-995f-436e-bfc6-339bcf7b9824', thumbnail: '' },
      { id: 'ls-1772075639470', title: 'QUY TRÌNH LÀM VIỆC', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/8b5725f6-51f9-4de4-a422-fc7c50774944', thumbnail: '' },
      { id: 'ls-1772075597263', title: 'TẠO TÀI KHOẢN KÊNH', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/a38b22ca-19ef-441a-ba5e-1b1daf00812d', thumbnail: '' },
      { id: 'ls-1772072741722', title: 'THIẾT LẬP KÊNH: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/5b8cf44f-e430-46c7-afab-532ef1ec8a8d', thumbnail: '' },
      { id: 'ls-1772072604822', title: 'THIẾT LẬP KÊNH: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/3ba1ee85-ae5e-4b43-9837-48924505d943', thumbnail: '' },
      { id: 'ls-1772073051667', title: 'THIẾT LẬP KÊNH: P3', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/714b3f99-226f-4961-b595-12905688c294', thumbnail: '' },
      { id: 'ls-1772073125103', title: 'THIẾT LẬP KÊNH: P4', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/1866f580-2023-414a-902f-8ebc19954e7a', thumbnail: '' },
      { id: 'ls-1772073201709', title: 'THIẾT LẬP KÊNH: P5', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/ba354eda-1c65-4390-a59a-4b3adb537e6b', thumbnail: '' },
      { id: 'ls-1772075545408', title: 'CÁC CHỈ SỐ KÊNH', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/2d647a34-907c-4746-abd4-41e52c4b4c81', thumbnail: '' },
      { id: 'ls-1772008739559', title: 'HƯỚNG DẪN TẠO APP QUẢN LÝ KÊNH: LARK', duration: '53:03', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/460f0a3f-80ed-4a17-8449-7ef94997c735', thumbnail: '' },
    ],
  },
  // Chapter 2: NGHIÊN CỨU KÊNH MẪU
  {
    id: 'ch-1772089009290',
    title: 'NGHIÊN CỨU KÊNH MẪU',
    lessons: [
      { id: 'ls-1772020188344-2', title: 'Kênh Mẫu', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/edc356df-325e-4a6c-b5f0-aabff3df953d', thumbnail: '' },
      { id: 'ls-1772007425778', title: 'KEY: Riddles', duration: '08:26', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/c55cf557-df20-4e35-93ae-ccb6b9d4e277', thumbnail: '' },
      { id: 'ls-1772006410372', title: 'KEY: Brain Test', duration: '15:02', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/c77502db-224f-4378-bf66-3018e5295f71', thumbnail: '' },
      { id: 'ls-1772006559050-2', title: 'KEY: Dấu Hiệu Nhận Biết Tâm Trạng Của Thú Cưng', duration: '06:56', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/88826d14-cd58-459a-a48d-0b51d7e440dc', thumbnail: '' },
      { id: 'ls-1772006603978-2', title: 'KEY: Tank', duration: '02:17', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/db3bb10b-1bbe-4d6c-82dd-186f93edfe86', thumbnail: '' },
      { id: 'ls-1772006653257', title: 'KEY: 360 độ', duration: '07:05', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/56dd165d-dfa2-4bff-a512-d0ba5c83d907', thumbnail: '' },
      { id: 'ls-1772006705905', title: 'KEY: Cuốc Sống Của Các Tỉ Phú', duration: '02:00', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/915f996c-a6cc-4150-8306-45828683b828', thumbnail: '' },
      { id: 'ls-1772006826871-2', title: 'KEY: Dog & Duck', duration: '05:39', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/716a65ca-cba2-4ccb-82e6-159876d414d2', thumbnail: '' },
      { id: 'ls-1772006768407-2', title: 'KEY Tham Khảo Của Kênh: SAM 98 FARM', duration: '01:24', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/265858a2-e800-44d0-a4e7-e9bba0bfa636', thumbnail: '' },
      { id: 'ls-1772006995509-2', title: 'KEY Tham Khảo Của Kênh Doctor Plants: P1', duration: '03:17', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/b3c3c2a1-f9e1-4048-b3c1-dffde986890b', thumbnail: '' },
      { id: 'ls-1772009719109-2', title: 'KEY Tham Khảo Của Kênh Doctor Plants: P2', duration: '04:09', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/6edc5240-15d4-4548-b3df-d70a56251544', thumbnail: '' },
      { id: 'ls-1772007219147', title: 'KEY Tham Khảo Của Kênh: bisko', duration: '02:11', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/4b287963-53fe-46e2-b0b9-a18a7d3286ed', thumbnail: '' },
      { id: 'ls-1772007821770', title: 'KEY Tham Khảo Của Kênh: Tung Tăng Khắp Miền', duration: '02:15', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/c015e344-4af7-4748-a77e-873aa9712ab1', thumbnail: '' },
      { id: 'ls-1772007294181', title: 'KEY: Đấu Vật', duration: '01:34', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/64794cb0-3330-4a8b-825f-ceaba44259ed', thumbnail: '' },
      { id: 'ls-1772011059264', title: 'KEY: Không Gian', duration: '02:51', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/0f2c9a58-9744-4822-8685-c6748201cf14', thumbnail: '' },
    ],
  },
  // Chapter 3: TỪ KHOÁ
  {
    id: 'ch-1772089157241',
    title: 'TỪ KHOÁ',
    lessons: [
      { id: 'ls-1772070593426-2', title: 'KEY', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/1f1125f1-278a-493d-9e27-875745d75388', thumbnail: '' },
      { id: 'ls-1772070697419-2', title: 'TOOL', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/41a529b2-c49e-437a-8672-3f01a2a30d1a', thumbnail: '' },
      { id: 'ls-1772070800114-2', title: 'TOOL AI', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/720afe0b-7352-4513-9621-6fd2c8511f4d', thumbnail: '' },
      { id: 'ls-1772071084562-2', title: '4 KEY - VIDEO', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/20a6547d-90a7-4953-a311-864390d7a801', thumbnail: '' },
      { id: 'ls-1772071590841', title: 'ĐO TỪ KHOÁ: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/599b630f-b837-4e5b-8141-142b673b8036', thumbnail: '' },
      { id: 'ls-1772071663027', title: 'ĐO TỪ KHOÁ: P2 - GOOGLE TRENDS', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/b7f18f4f-dcff-41e8-ad54-3b695a5d2363', thumbnail: '' },
      { id: 'ls-1772071665330', title: 'ĐO TỪ KHOÁ: P3 - GOOGLE SEARCH', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/37bcf4a0-b3dd-4241-b0b0-f87de2d3b351', thumbnail: '' },
      { id: 'ls-1772071667779', title: 'ĐO TỪ KHOÁ: P4 - KEYWORD PLANNER', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/d55d15ec-f245-4244-a97e-0eaed018f6f2', thumbnail: '' },
      { id: 'ls-1772071986009', title: 'ĐO TỪ KHOÁ: P5 - VIDIQ', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/b4ed2e5d-98dc-402f-b929-ff95de984390', thumbnail: '' },
      { id: 'ls-1772007595034', title: 'BỘ TỪ KHOÁ THAM KHẢO CỰC NGON ĐỂ XÂY KÊNH', duration: '13:31', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/0973ab98-7e0e-4e5b-8fbb-d9a3bca42438', thumbnail: '' },
      { id: 'ls-1772009471674', title: 'CÁC TỪ KHOÁ TỐT DÙNG ĐỂ XÂY KÊNH', duration: '01:30', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/d48a809d-ef70-4feb-b3b3-c6a12d3e47c5', thumbnail: '' },
      { id: 'ls-1772007712554', title: 'TOP 10 CHỦ ĐỀ MÃI XANH', duration: '05:10', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/fa20fa6b-84ad-464d-bcfe-885e11126d83', thumbnail: '' },
      { id: 'ls-1772007658427', title: 'TOP 30 TỪ KHOÁ', duration: '01:10', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/6f13deb2-49c5-4c37-8553-c9d03b61c043', thumbnail: '' },
    ],
  },
  // Chapter 4: TÌM CHỦ ĐỀ - NGÁCH
  {
    id: 'ch-1772089326120',
    title: 'TÌM CHỦ ĐỀ - NGÁCH',
    lessons: [
      { id: 'ls-1772071120113-2', title: 'CHỦ ĐỀ', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/385843f3-973a-4c2e-b036-5e949b3400ab', thumbnail: '' },
      { id: 'ls-1772071218589-2', title: 'QUY TRÌNH TÌM KEY: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/d76e5fed-efcb-44a7-96c5-210667e1ba8d', thumbnail: '' },
      { id: 'ls-1772071307260-2', title: 'QUY TRÌNH TÌM KEY: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/cb08c263-122f-4ce1-b765-4288d532ded9', thumbnail: '' },
      { id: 'ls-1772071317107-2', title: 'QUY TRÌNH TÌM KEY: P3 - 1OF10', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/1dc5b14f-1236-4551-82aa-4af0b5e5b158', thumbnail: '' },
      { id: 'ls-1772071328627-2', title: 'QUY TRÌNH TÌM KEY: P4 - NEXLEV', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/23967db5-f3ed-4973-8d06-4ef270a164dd', thumbnail: '' },
      { id: 'ls-1772010819855', title: 'PHÂN TÍCH VÀ TÌM NGÁCH XÂY KÊNH', duration: '08:40', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/f8b01859-7c55-4f98-a5de-d4283e2a0ca3', thumbnail: '' },
      { id: 'ls-1772010861304', title: 'CÁCH TÌM KIẾM CHỦ ĐỀ CHUYÊN SÂU: P1', duration: '11:57', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/1f8d7e91-e5f0-40e1-87bd-b53c8fc9845a', thumbnail: '' },
      { id: 'ls-1772010876815', title: 'CÁCH TÌM KIẾM CHỦ ĐỀ CHUYÊN SÂU: P2', duration: '05:00', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/3edcd412-f6c9-4cf2-919e-f8aba391177e', thumbnail: '' },
      { id: 'ls-1772010902776', title: 'CÁCH TÌM KIẾM CHỦ ĐỀ CHUYÊN SÂU: P3', duration: '08:01', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/1a251038-be3c-4398-8315-9493de306cf1', thumbnail: '' },
    ],
  },
  // Chapter 5: CONTENT
  {
    id: 'ch-1772089586485',
    title: 'CONTENT',
    lessons: [
      { id: 'ls-1772007980514', title: 'TƯ DUY VIẾT CONTENT', duration: '02:30', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/2d84c3b6-9517-4390-87ef-f2974863892d', thumbnail: '' },
      { id: 'ls-1773112721259', title: 'QUY TRÌNH SẢN XUẤT NỘI DUNG CONTENT', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/8eafb4f1-73dc-4b3f-bc23-0d60c381573b', thumbnail: '' },
      { id: 'ls-1773113087329', title: 'HƯỚNG DẪN TẠO NỘI DUNG CONTENT', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/8f05bf0c-2d26-4e39-b232-56631f93d65b', thumbnail: '' },
      { id: 'ls-1772074565634', title: 'CONTENT', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/96b8e8b1-77f9-47cd-81c9-9f0495b68d20', thumbnail: '' },
      { id: 'ls-1772008131267', title: 'HƯỚNG DẪN LÀM CONTENT DẠNG VĂN', duration: '62:07', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/69ee45f8-fb9e-4310-8d11-d3df10202b6b', thumbnail: '' },
      { id: 'ls-1772008080250', title: 'HƯỚNG DẪN LÀM CONTENT DẠNG QUIZ', duration: '25:52', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/9580c694-4bd4-468a-9bd2-c4072838909e', thumbnail: '' },
      { id: 'ls-1772008191090', title: 'HƯỚNG DẪN TẠO APP VIẾT CONTENT TỰ ĐỘNG', duration: '08:32', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/e64e6663-3430-4b03-a487-7ccc742939f9', thumbnail: '' },
      { id: 'ls-1773112452009', title: 'CÁCH TÌM CÔNG THỨC TẠO HOOK', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/c3db3d7c-aaed-4fab-985c-e3db6eb9b83a', thumbnail: '' },
      { id: 'ls-1773112506851', title: 'CÁCH VIẾT HOOK', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/86bcfe97-8950-4011-9c54-1b3f0adae77b', thumbnail: '' },
      { id: 'ls-1773112833352', title: 'CÁCH TÌM NỘI DUNG TRÊN CÁC NỀN TẢNG', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/b9039690-c122-4906-a4e7-e8308d274c21', thumbnail: '' },
      { id: 'ls-1773113051248', title: 'TUYẾN NỘI DUNG CHÍNH VÀ PHỤ', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/2fa6a71b-340e-4192-994c-3ea54862f279', thumbnail: '' },
    ],
  },
  // Chapter 6: EDIT VIDEO
  {
    id: 'ch-1772089705971',
    title: 'EDIT VIDEO',
    lessons: [
      { id: 'ls-1772073555565', title: 'LÀM VIDEO - TIẾN HÀNH SẢN XUẤT: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/2fb7192c-0b98-4bd6-be26-e4d676df66e2', thumbnail: '' },
      { id: 'ls-1772073591276', title: 'LÀM VIDEO - TIẾN HÀNH SẢN XUẤT: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/2741db57-072e-462f-ae8c-0cd3d69ff743', thumbnail: '' },
      { id: 'ls-1772073672914', title: 'LÀM VIDEO - TIẾN HÀNH SẢN XUẤT: P3', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/2ef87c88-2a00-4e18-9a24-731fa21928d6', thumbnail: '' },
      { id: 'ls-1772073729488', title: 'LÀM VIDEO - TIẾN HÀNH SẢN XUẤT: P4', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/4c29d5fa-1d44-44fa-85b0-4547e4ef71ec', thumbnail: '' },
      { id: 'ls-1772073741681', title: 'LÀM VIDEO - TIẾN HÀNH SẢN XUẤT: P5', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/4a7c2437-3efa-4b64-af53-1eff7c0404f2', thumbnail: '' },
      { id: 'ls-1772074690822', title: 'SẢN XUẤT VIDEO: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/69d81fac-ed45-41f5-a828-fd614294ef03', thumbnail: '' },
      { id: 'ls-1772074916369', title: 'SẢN XUẤT VIDEO: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/45ddd251-ed44-40f2-962b-1b8dc8243b3f', thumbnail: '' },
      { id: 'ls-1772074920768', title: 'SẢN XUẤT VIDEO: P3', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/fcbe982b-0551-4369-93b4-1d52176668bc', thumbnail: '' },
      { id: 'ls-1772075268129', title: 'SẢN XUẤT VIDEO: P4', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/bdad7a2e-746f-4952-b8cf-88d4fffcd535', thumbnail: '' },
      { id: 'ls-1772075348240', title: 'THUMBNAIL', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/5337c1db-5340-4875-ab6c-1071665a9f53', thumbnail: '' },
    ],
  },
  // Chapter 7: SEO
  {
    id: 'ch-1772089864090',
    title: 'SEO',
    lessons: [
      { id: 'ls-1772075404704', title: 'SEO', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/13b6bb05-26d8-4384-a694-db93d379a526', thumbnail: '' },
      { id: 'ls-1772074227711', title: 'TƯƠNG TÁC KÊNH: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/65253fc3-0ebe-4c7d-a1e1-9a73c5b46c07', thumbnail: '' },
      { id: 'ls-1772074269834', title: 'TƯƠNG TÁC KÊNH: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/4bcb7ce0-a8f5-4621-a048-21806ffe0e2e', thumbnail: '' },
    ],
  },
  // Chapter 8: CHIẾN LƯỢC RPM CAO
  {
    id: 'ch-1772089910112',
    title: 'CHIẾN LƯỢC RPM CAO',
    lessons: [
      { id: 'ls-1772075481049', title: '8 CHIẾN LƯỢC RPM CAO', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/10378daf-17dc-48fc-8d8b-8623d752e4ef', thumbnail: '' },
      { id: 'ls-1773113176171', title: 'BỘ TỪ KHOÁ CBC', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/e69c50ee-68c9-4fc1-b221-4176693be692', thumbnail: '' },
    ],
  },
  // Chapter 9: EDIT VIDEO DẠNG QUIZ
  {
    id: 'ch-1773115569386',
    title: 'EDIT VIDEO DẠNG QUIZ',
    lessons: [
      { id: 'ls-1772008297714', title: 'HƯỚNG DẪN EDIT VIDEO DẠNG QUIZ: P1', duration: '65:00', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/5fc19265-bfb3-4fa6-91ea-204d79f8e22d', thumbnail: '' },
      { id: 'ls-1772008405195', title: 'HƯỚNG DẪN EDIT VIDEO DẠNG QUIZ: P2', duration: '34:49', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/18bb9b13-6da0-4885-ab9f-656f47181c98', thumbnail: '' },
      { id: 'ls-1772008477670', title: 'HƯỚNG DẪN EDIT AUDIO DẠNG QUIZ', duration: '44:23', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/264c8adc-40a6-45d8-bd26-421849802feb', thumbnail: '' },
      { id: 'ls-1773113628897', title: 'HƯỚNG DẪN EDIT VIDEO QUIZ BẰNG CANVA', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/50a85371-0f56-4f87-8ec2-031391c42d15', thumbnail: '' },
      { id: 'ls-1772006108274', title: 'LƯU Ý KHI LÀM VIDEO DẠNG QUIZ', duration: '04:22', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/64dbf666-06e4-43d6-9767-fd38bf4022d0', thumbnail: '' },
    ],
  },
  // Chapter 10: EDIT VIDEO DẠNG SHORTS
  {
    id: 'ch-1773115727940',
    title: 'EDIT VIDEO DẠNG SHORTS',
    lessons: [
      { id: 'ls-1773113295813', title: 'CÁCH TẠO PROMPT ĐẦY ĐỦ CHI TIẾT', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/4571e182-f845-47a6-a2bc-1e5a0810ba8b', thumbnail: '' },
      { id: 'ls-1773113350762', title: 'HƯỚNG DẪN TẠO ẢNH VÀ VIDEO TỪ PROMPT', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/7e664e81-e3ec-4c75-a306-2105301cf87f', thumbnail: '' },
      { id: 'ls-1773113387065', title: 'HƯỚNG DẪN EDIT VIDEO SHORTS', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/878e2158-085c-4a38-acbf-696e6d7ea67e', thumbnail: '' },
    ],
  },
  // Chapter 11: EDIT DẠNG VIDEO KỂ CHUYỆN
  {
    id: 'ch-1773116060590',
    title: 'EDIT DẠNG VIDEO KỂ CHUYỆN',
    lessons: [
      { id: 'ls-1772008532284', title: 'HƯỚNG DẪN EDIT VIDEO DẠNG NGƯỜI GIÀ KỂ CHUYỆN: P1', duration: '50:23', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/0ad77773-e0bb-43d2-b0ce-2347ef3bd704', thumbnail: '' },
      { id: 'ls-1773117314307', title: 'HƯỚNG DẪN EDIT VIDEO DẠNG NGƯỜI GIÀ KỂ CHUYỆN: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/45e9bd19-e6f2-4be5-be49-5e47cec9eb5c', thumbnail: '' },
    ],
  },
  // Chapter 12: NGHIÊN CỨU KÊNH DẠNG QUIZ CÂU ĐỐ
  {
    id: 'ch-1773116160000',
    title: 'NGHIÊN CỨU KÊNH DẠNG QUIZ CÂU ĐỐ',
    lessons: [
      { id: 'ls-1773116299397', title: 'KEY: RIDDLES & BRAIN TEST: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/c55cf557-df20-4e35-93ae-ccb6b9d4e277', thumbnail: '' },
      { id: 'ls-1773117049730', title: 'KEY: RIDDLES & BRAIN TEST: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/3a2b2695-7f67-4021-8e47-b54f3c401b7f', thumbnail: '' },
      { id: 'ls-1773117212307', title: 'KEY: RIDDLES & BRAIN TEST: P3', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/5ae946b5-3941-4abc-9539-30370044df0e', thumbnail: '' },
      { id: 'ls-1773116608215', title: 'BỘ KEY THAM KHẢO CÂU ĐỐ: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/0973ab98-7e0e-4e5b-8fbb-d9a3bca42438', thumbnail: '' },
      { id: 'ls-1773116873688', title: 'BỘ KEY THAM KHẢO CÂU ĐỐ: P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/c77502db-224f-4378-bf66-3018e5295f71', thumbnail: '' },
    ],
  },
  // Chapter 13: NGHIÊN CỨU KÊNH DẠNG ĐỘNG VẬT
  {
    id: 'ch-1773117473811',
    title: 'NGHIÊN CỨU KÊNH DẠNG ĐỘNG VẬT',
    lessons: [
      { id: 'ls-1772006995509', title: 'KEY Tham Khảo Của Kênh Doctor Plants: P1', duration: '03:17', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/b3c3c2a1-f9e1-4048-b3c1-dffde986890b', thumbnail: '' },
      { id: 'ls-1772009719109', title: 'KEY Tham Khảo Của Kênh Doctor Plants: P2', duration: '04:09', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/6edc5240-15d4-4548-b3df-d70a56251544', thumbnail: '' },
      { id: 'ls-1772006826871', title: 'KEY: Dog & Duck', duration: '05:39', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/716a65ca-cba2-4ccb-82e6-159876d414d2', thumbnail: '' },
      { id: 'ls-1772006559050', title: 'KEY: Dấu Hiệu Nhận Biết Tâm Trạng Của Thú Cưng', duration: '06:56', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/88826d14-cd58-459a-a48d-0b51d7e440dc', thumbnail: '' },
      { id: 'ls-1772006768407', title: 'KEY Tham Khảo Của Kênh: SAM 98 FARM', duration: '01:24', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/265858a2-e800-44d0-a4e7-e9bba0bfa636', thumbnail: '' },
      { id: 'ls-1772006603978', title: 'KEY: Tank', duration: '02:17', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/db3bb10b-1bbe-4d6c-82dd-186f93edfe86', thumbnail: '' },
    ],
  },
  // Chapter 14: TƯ DUY
  {
    id: 'ch-1773118021058',
    title: 'TƯ DUY',
    lessons: [
      { id: 'ls-1773118410358', title: 'TƯ DUY 1%: P1', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/d4d1e0d6-adb7-4e46-abc2-f3eaf71cd34a', thumbnail: '' },
      { id: 'ls-1773118058846', title: 'TƯ DUY 1% P2', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/8b638a6d-c152-464f-8e44-8635bc0f311c', thumbnail: '' },
      { id: 'ls-1773118107662', title: 'PHÁT TRIỂN BẢN THÂN', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/ea44ea13-f16e-4e99-9f6c-7f5e5045dfbc', thumbnail: '' },
      { id: 'ls-1773118124726', title: 'GIÁ TRỊ VÀ MỐI QUAN HỆ', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/ea44ea13-f16e-4e99-9f6c-7f5e5045dfbc', thumbnail: '' },
      { id: 'ls-1773118319743', title: 'THU NHẬP THỤ ĐỘNG', duration: '', requiredLevel: 'Free', directPlayUrl: 'https://iframe.mediadelivery.net/embed/598901/f0efd322-14b2-4d70-a71a-d5293dac79d0', thumbnail: '' },
    ],
  },
];

// =============================================
// Exported map
// =============================================
export const FALLBACK_CHAPTERS: Record<string, Chapter[]> = {
  '1': COURSE_1_CHAPTERS,
  '6': COURSE_6_CHAPTERS,
};

/** Get fallback chapter stats */
export function getFallbackChapterStats(courseId: string): { lessonsCount: number; duration: number; chaptersCount: number } | null {
  const chapters = FALLBACK_CHAPTERS[courseId];
  if (!chapters) return null;

  let lessonsCount = 0;
  let duration = 0;
  for (const ch of chapters) {
    lessonsCount += ch.lessons.length;
    for (const ls of ch.lessons) {
      if (ls.duration) {
        const parts = ls.duration.split(':');
        if (parts.length === 2) {
          duration += (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
        }
      }
    }
  }
  return { lessonsCount, duration, chaptersCount: chapters.length };
}
