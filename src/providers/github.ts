import axios from 'axios';
import * as cheerio from 'cheerio';
import type { NormalizedRepo, TrendingProvider } from './types';

export class GitHubProvider implements TrendingProvider {
  async getTrendingFullNames(): Promise<string[]> {
    const response = await axios.get('https://github.com/trending?since=daily1');
    const $ = cheerio.load(response.data);
    const repoLinks = $('a[href*="/"]:has(.octicon-repo)');

    const fullNames: string[] = [];
    for (const link of repoLinks) {
      const href = $(link).attr('href');
      if (!href) continue;
      const fullName = href.replace(/^\//, '');
      if (fullName && !fullNames.includes(fullName)) fullNames.push(fullName);
    }
    return fullNames;
  }

  async getRepoDetail(fullName: string, token?: string): Promise<NormalizedRepo> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json'
    };
    if (token) headers['Authorization'] = `token ${token}`;

    const apiResponse = await axios.get(`https://api.github.com/repos/${fullName}`, {
      headers
    });

    const repoData = apiResponse.data;
    const topics = Array.isArray(repoData.topics) ? repoData.topics.join(',') : '';

    return {
      github_id: String(repoData.id),
      node_id: String(repoData.node_id),
      name: repoData.name,
      full_name: repoData.full_name,
      owner_login: repoData.owner.login,
      owner_id: String(repoData.owner.id),
      owner_avatar_url: repoData.owner.avatar_url,
      owner_html_url: repoData.owner.html_url,
      html_url: repoData.html_url,
      description: repoData.description ?? null,
      url: repoData.url,
      size: repoData.size,
      stargazers_count: repoData.stargazers_count,
      watchers_count: repoData.watchers_count,
      language: repoData.language ?? null,
      forks_count: repoData.forks_count,
      open_issues_count: repoData.open_issues_count,
      license_key: repoData.license?.key ?? null,
      license_name: repoData.license?.name ?? null,
      topics,
      default_branch: repoData.default_branch,
      subscribers_count: repoData.subscribers_count
    };
  }
}

export default function getGitHubProvider() {
  return new GitHubProvider();
}