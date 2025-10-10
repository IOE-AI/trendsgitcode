import axios from 'axios';
import * as cheerio from 'cheerio';
import type { NormalizedRepo, TrendingProvider } from './types';
import { delay } from './types';

// NOTE: GitCode 的公开趋势/热门 API页面结构可能会变化。
// 这里提供一个占位实现：尝试从 Explore 页面解析仓库链接。
// 你可以根据 GitCode 的实际 API 替换为更稳定的调用。

export class GitCodeProvider implements TrendingProvider {
  private cache = new Map<string, any>();
  async getTrendingFullNames(): Promise<string[]> {
    // 使用公开 API 分页加载「热门精选」列表，直到返回空 content
    const fullNames = new Set<string>();
    let pageNum = 1;
    const perPage = 18;
    const maxPages = 200; // 安全阈值，防止无限循环

    const buildUrl = (page: number) =>
      `https://web-api.gitcode.com/api/v1/agg/index?page=${page}&per_page=${perPage}&total=0&channel_id=all&sub_channel_id=&repo_type=-1&m_code=hotSelection&d_code=index_hot_star&c_id=all`;

    try {
      while (pageNum <= maxPages) {
        const apiUrl = buildUrl(pageNum);
        const response = await axios.get(apiUrl, {
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            Referer: 'https://gitcode.com/',
            Origin: 'https://gitcode.com',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        const data = response.data || {};
        const content: any[] = Array.isArray(data.content) ? data.content : [];

        // 没有更多数据时，接口会返回空 content
        if (!content.length) break;

        for (const item of content) {
          const urlStr = String(item?.url || '').trim().replace(/`/g, '');
          if (!urlStr) continue;
          try {
            const u = new URL(urlStr);
            const parts = u.pathname.split('/').filter(Boolean);
            if (parts.length >= 2) {
              const fullName = parts.join('/');
              if (!fullNames.has(fullName)) {
                fullNames.add(fullName);
                this.cache.set(fullName, item);
              }
            }
          } catch {
            // ignore malformed URLs
          }
        }

        pageNum++;
        await delay(200); // 轻微节流，降低被 WAF 拦截概率
      }

      return Array.from(fullNames);
    } catch {
      return Array.from(fullNames);
    }
  }

  async getRepoDetail(fullName: string, _token?: string): Promise<NormalizedRepo> {
    // 基础信息（先用聚合 API 的缓存，随后尝试详情接口覆盖）
    const cached = this.cache.get(fullName);
    const segments = fullName.split('/').filter(Boolean);
    const owner = segments[0];
    const repoName = segments.slice(1).join('/') || segments[0];
    const name = repoName;
    const baseUrl: string = `https://gitcode.com/${fullName}`;
    const cachedUrl: string = String(cached?.url || baseUrl).trim().replace(/`/g, '');
    const cachedLang: string | null = Array.isArray(cached?.language)
      ? (cached.language[0] ?? null)
      : typeof cached?.language === 'string'
      ? cached.language
      : null;
    const cachedTopics: string = Array.isArray(cached?.topic) ? cached.topic.join(',') : '';

    let result: NormalizedRepo = {
      github_id: fullName,
      node_id: String(cached?.id ?? fullName),
      name,
      full_name: fullName,
      owner_login: owner,
      owner_id: owner,
      owner_avatar_url: String(cached?.avatar || `https://cdn-static.gitcode.com/static/images/logo-favicon.png`),
      owner_html_url: `https://gitcode.com/${owner}`,
      html_url: cachedUrl,
      description: cached?.description ?? null,
      url: cachedUrl,
      size: 0,
      stargazers_count: Number(cached?.star_count ?? 0),
      watchers_count: Number(cached?.watch_count ?? cached?.star_count ?? 0),
      language: cachedLang,
      forks_count: Number(cached?.fork_count ?? 0),
      open_issues_count: Number(cached?.open_issues_count ?? 0),
      license_key: null,
      license_name: null,
      topics: cachedTopics,
      default_branch: 'main',
      subscribers_count: 0
    };

    // 详情接口：提供更完整/可信的数据（头像、语言、话题、许可证等）
    try {
      const detailsUrl = `https://web-api.gitcode.com/api/v2/projects/${encodeURIComponent(fullName)}?repoId=${encodeURIComponent(encodeURIComponent(fullName))}&statistics=true&view=all`;
      const resp = await axios.get(detailsUrl, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Referer: 'https://gitcode.com/',
          Origin: 'https://gitcode.com',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      const d = resp.data;
      if (d && typeof d === 'object') {
        const ns = d.namespace || {};
        const ownerLogin = String(ns.full_path || owner);
        const ownerAvatar = String(ns.avatar_url || d.avatar_url || result.owner_avatar_url || `https://cdn-static.gitcode.com/static/images/logo-favicon.png`);
        const repoUrl = String(d.web_url || result.html_url || baseUrl).trim().replace(/`/g, '');
        const licenseKey = (d.license && d.license.key) ? String(d.license.key) : null;
        const licenseName = (d.license && d.license.name) ? String(d.license.name) : null;

        const language: string | null = Array.isArray(d.main_repository_language)
          ? (d.main_repository_language[0] ?? null)
          : typeof d.main_repository_language === 'string'
          ? d.main_repository_language
          : result.language ?? null;

        const topics: string = Array.isArray(d.topic_names)
          ? d.topic_names.map((t: any) => t?.name).filter(Boolean).join(',')
          : Array.isArray(d.tag_list)
          ? d.tag_list.filter(Boolean).join(',')
          : result.topics;

        result = {
          github_id: fullName,
          node_id: String(d.id ?? result.node_id ?? fullName),
          name: String(d.path || d.name || result.name || name),
          full_name: fullName,
          owner_login: ownerLogin,
          owner_id: ownerLogin,
          owner_avatar_url: ownerAvatar,
          owner_html_url: `https://gitcode.com/${ownerLogin}`,
          html_url: repoUrl,
          description: d.description ?? d.description_cn ?? result.description ?? null,
          url: repoUrl,
          size: 0,
          stargazers_count: Number(d.star_count ?? result.stargazers_count ?? 0),
          watchers_count: Number(d.watch_count ?? result.watchers_count ?? d.star_count ?? 0),
          language,
          forks_count: Number(d.forks_count ?? d.mirror_project_data?.fork_count ?? result.forks_count ?? 0),
          open_issues_count: Number(d.open_issues_count ?? result.open_issues_count ?? 0),
          license_key: licenseKey,
          license_name: licenseName,
          topics,
          default_branch: String(d.default_branch || result.default_branch || 'main'),
          subscribers_count: Number(d.member_count ?? result.subscribers_count ?? 0)
        };
      }
    } catch {
      // 被 WAF 拦截或接口失败时，继续使用聚合/兜底数据
    }

    // 若没有缓存，进行兜底：页面最小解析
    if (!cached) {
      const repoUrl = `https://gitcode.com/${fullName}`;
      try {
        const response = await axios.get(repoUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            Referer: 'https://gitcode.com/',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        const $ = cheerio.load(response.data);
        const desc = $('meta[name="description"]').attr('content') || result.description || null;
        const langBadge = $('[class*="language"], .lang, .language').first().text().trim();
        const lang = (langBadge || result.language || null);
        result.description = desc;
        result.language = lang;
        result.html_url = result.html_url || repoUrl;
        result.url = result.url || repoUrl;
      } catch {
        // ignore
      }
    }

    return result;
  }
}

export default function getGitCodeProvider() {
  return new GitCodeProvider();
}