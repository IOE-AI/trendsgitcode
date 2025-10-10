import { prisma } from '@/lib/db';
import type { NextApiRequest, NextApiResponse } from 'next';
import getGitHubProvider from '../../src/providers/github';
import getGitCodeProvider from '../../src/providers/gitcode';
import type { TrendingProvider } from '../../src/providers/types';
import { delay } from '../../src/providers/types';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  console.log('Seeding process started');
  console.log(`Provider: ${process.env.GIT_PROVIDER}`);

  try {
    const providerEnv = process.env.GIT_PROVIDER?.toLowerCase() || 'github';
    const provider: TrendingProvider = providerEnv === 'gitcode' ? getGitCodeProvider() : getGitHubProvider();
    const token = providerEnv === 'gitcode' ? process.env.GITCODE_TOKEN : process.env.GITHUB_TOKEN;

    const fullNames = await provider.getTrendingFullNames();
    if (!fullNames.length) {
      console.warn(`No trending repos found for provider: ${providerEnv}`);
    }

    let createdCount = 0;
    let updatedCount = 0;
    const buffer: any[] = [];

    for (const fullName of fullNames) {
      const normalized = await provider.getRepoDetail(fullName, token);

      buffer.push({ ...normalized, created_at: new Date(Date.now()) });
      await delay(1000);
    }

    // Insert or update records
    for (const item of buffer.reverse()) {
      const existingRepo = await prisma.repo.findFirst({
        where: { github_id: String(item.github_id) },
      });

      if (existingRepo) {
        await prisma.repo.update({
          where: { id: existingRepo.id },
          data: {
            node_id: String(item.node_id),
            name: item.name,
            full_name: item.full_name,
            owner_login: item.owner_login,
            owner_id: String(item.owner_id),
            owner_avatar_url: item.owner_avatar_url,
            owner_html_url: item.owner_html_url,
            html_url: item.html_url,
            description: item.description,
            url: item.url,
            size: item.size,
            stargazers_count: item.stargazers_count,
            watchers_count: item.watchers_count,
            language: item.language,
            forks_count: item.forks_count,
            open_issues_count: item.open_issues_count,
            license_key: item.license_key,
            license_name: item.license_name,
            topics: item.topics,
            default_branch: item.default_branch,
            subscribers_count: item.subscribers_count,
          },
        });
        updatedCount++;
      } else {
        await prisma.repo.create({
          data: item,
        });
        createdCount++;
      }
    }

    res.status(200).json({ message: 'Seed completed', provider: providerEnv, created: createdCount, updated: updatedCount });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Error seeding database', error: error.message });
  }
}
