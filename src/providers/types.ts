export interface NormalizedRepo {
  github_id: string;
  node_id: string;
  name: string;
  full_name: string;
  owner_login: string;
  owner_id: string;
  owner_avatar_url: string;
  owner_html_url: string;
  html_url: string;
  description: string | null;
  url: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  license_key: string | null;
  license_name: string | null;
  topics: string; // comma-separated
  default_branch: string;
  subscribers_count: number;
}

export interface TrendingProvider {
  getTrendingFullNames(): Promise<string[]>;
  getRepoDetail(fullName: string, token?: string): Promise<NormalizedRepo>;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}