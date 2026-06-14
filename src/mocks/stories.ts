import { Story } from '@/types';

const agoIso = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

export const stories: Story[] = [
  {
    id: 'my-story',
    authorId: 'u0',
    imageUri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=85',
    caption: 'Great evening at Cubbon. Good vibes all around ✨',
    planLabel: 'Evening Walk · Cubbon Park',
    createdAt: agoIso(12),
    isSeen: true,
  },
  {
    id: 's0',
    authorId: 'u2',
    imageUri: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&q=85',
    caption: 'Best morning run at Cubbon. Weather was absolutely perfect today 🌅',
    planLabel: 'Morning Run · Cubbon Park',
    createdAt: agoIso(18),
    isSeen: false,
  },
  {
    id: 's1',
    authorId: 'u1',
    imageUri: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=85',
    caption: 'Coffee turned into a 2-hour chat. Love this city ☕',
    planLabel: 'Coffee · Third Wave',
    createdAt: agoIso(45),
    isSeen: false,
  },
  {
    id: 's2',
    authorId: 'u3',
    imageUri: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=85',
    caption: '4 strangers, 2 hours of badminton, now friends 🏸',
    planLabel: 'Badminton · SportZone',
    createdAt: agoIso(90),
    isSeen: true,
  },
  {
    id: 's3',
    authorId: 'u4',
    imageUri: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=85',
    caption: 'Truffles never disappoints. Perfect spontaneous dinner 🍝',
    planLabel: 'Dinner · Truffles',
    createdAt: agoIso(150),
    isSeen: true,
  },
  {
    id: 's4',
    authorId: 'u5',
    imageUri: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=85',
    caption: 'Nandi Hills at sunrise. Worth every early alarm 🚴',
    planLabel: 'Cycling · Nandi Hills',
    createdAt: agoIso(210),
    isSeen: false,
  },
];
