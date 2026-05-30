import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from './_lib/theme';
import { api, fetchWithCache, CacheManager } from './_lib/api';

interface SearchResult {
  resource_type: 'paper' | 'note' | 'video' | 'assignment';
  resource_id: string;
  title: string;
  description?: string;
  node_id: string;
  year?: number;
  semester?: number;
  exam_type?: string;
  author?: string;
  tags: string[];
  view_count: number;
  download_count: number;
  created_at: string;
  thumbnail_url?: string;
  url?: string;
}

interface FilterState {
  resourceType: string | null;
  sortBy: 'latest' | 'most_viewed' | 'most_downloaded';
  pdfOnly: boolean;
}

const COLORS_CUSTOM = {
  paper: '#38BDF8',
  note: '#4ADE80',
  video: '#F59E0B',
  assignment: '#EF4444',
};

const ICON_MAP = {
  paper: 'file-pdf-box',
  note: 'note-text',
  video: 'play-circle',
  assignment: 'checkbox-marked-circle',
};

export default function SearchScreen() {
  const router = useRouter();
  const { initial_query } = useLocalSearchParams();
  
  const [searchInput, setSearchInput] = useState(initial_query ? String(initial_query) : '');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    resourceType: null,
    sortBy: 'latest',
    pdfOnly: false,
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Perform search
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams();
      params.append('q', query);
      if (filters.resourceType) params.append('resource_type', filters.resourceType);
      params.append('sort_by', filters.sortBy);
      params.append('limit', '50');

      const response = await api.get<SearchResult[]>(`/search?${params.toString()}`);
      let filtered = response.data;

      // Apply PDF only filter
      if (filters.pdfOnly) {
        filtered = filtered.filter(r => r.tags.includes('pdf') || r.url?.includes('.pdf'));
      }

      setResults(filtered);
      
      // Cache results
      await CacheManager.set(`search-${query}-${JSON.stringify(filters)}`, filtered, 3600000); // 1 hour
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', 'Failed to search resources. Please try again.');
    } finally {
      setSearching(false);
    }
  }, [filters]);

  // Handle search input
  const handleSearch = (text: string) => {
    setSearchInput(text);
    if (text.length > 2) {
      setSearchQuery(text);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim().length > 2) {
        performSearch(searchInput);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput, performSearch]);

  // Auto-search on initial load
  useEffect(() => {
    if (initial_query) {
      performSearch(String(initial_query));
    }
  }, [initial_query]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await performSearch(searchInput);
    setRefreshing(false);
  };

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    performSearch(searchInput);
  };

  const trackView = async (resource: SearchResult) => {
    try {
      await api.post(`/resources/${resource.resource_type}/${resource.resource_id}/view`);
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const handleResourcePress = (resource: SearchResult) => {
    trackView(resource);
    
    // Navigate to resource detail or open URL
    if (resource.url) {
      // In production, you'd open the URL or navigate to a detail screen
      Alert.alert('Resource', `${resource.title}\n\nViews: ${resource.view_count}\nDownloads: ${resource.download_count}`);
    }
  };

  const renderSearchResultCard = ({ item: result }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => handleResourcePress(result)}
      activeOpacity={0.7}
    >
      <View style={styles.resultContent}>
        <View style={styles.resultHeader}>
          <MaterialCommunityIcons
            name={ICON_MAP[result.resource_type]}
            size={24}
            color={COLORS_CUSTOM[result.resource_type]}
            style={styles.resultIcon}
          />
          <View style={styles.resultTitleContainer}>
            <Text style={styles.resultTitle} numberOfLines={2}>
              {result.title}
            </Text>
            <Text style={styles.resultDescription} numberOfLines={1}>
              {result.description}
            </Text>
          </View>
        </View>

        <View style={styles.resultTags}>
          {result.tags.slice(0, 3).map((tag, idx) => (
            <View key={idx} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.resultFooter}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <MaterialIcons name="visibility" size={14} color={COLORS.textSecondary} />
              <Text style={styles.statText}>{result.view_count}</Text>
            </View>
            <View style={styles.stat}>
              <MaterialIcons name="download" size={14} color={COLORS.textSecondary} />
              <Text style={styles.statText}>{result.download_count}</Text>
            </View>
            {result.year && (
              <Text style={styles.year}>{result.year}</Text>
            )}
          </View>
          <Text style={styles.date}>
            {new Date(result.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFilterButton = (label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity
      style={[styles.filterButton, active && styles.filterButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterButtonText, active && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={24} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by subject, year, keyword..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchInput}
            onChangeText={handleSearch}
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => setSearchInput('')}>
              <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick Filters */}
      <View style={styles.quickFiltersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderFilterButton('Papers', filters.resourceType === 'papers', () =>
            handleFilterChange({
              resourceType: filters.resourceType === 'papers' ? null : 'papers',
            })
          )}
          {renderFilterButton('Notes', filters.resourceType === 'notes', () =>
            handleFilterChange({
              resourceType: filters.resourceType === 'notes' ? null : 'notes',
            })
          )}
          {renderFilterButton('Videos', filters.resourceType === 'videos', () =>
            handleFilterChange({
              resourceType: filters.resourceType === 'videos' ? null : 'videos',
            })
          )}
          {renderFilterButton('Assignments', filters.resourceType === 'assignments', () =>
            handleFilterChange({
              resourceType: filters.resourceType === 'assignments' ? null : 'assignments',
            })
          )}
          <TouchableOpacity
            style={[styles.filterButton, showAdvancedFilters && styles.filterButtonActive]}
            onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <MaterialIcons
              name={showAdvancedFilters ? 'filter-list-off' : 'filter-list'}
              size={18}
              color={showAdvancedFilters ? COLORS.primary : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.filterButtonText,
                showAdvancedFilters && styles.filterButtonTextActive,
              ]}
            >
              More
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <View style={styles.advancedFiltersContainer}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Sort By</Text>
            <View style={styles.filterOptions}>
              {renderFilterButton('Latest', filters.sortBy === 'latest', () =>
                handleFilterChange({ sortBy: 'latest' })
              )}
              {renderFilterButton('Most Viewed', filters.sortBy === 'most_viewed', () =>
                handleFilterChange({ sortBy: 'most_viewed' })
              )}
              {renderFilterButton('Most Downloaded', filters.sortBy === 'most_downloaded', () =>
                handleFilterChange({ sortBy: 'most_downloaded' })
              )}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => handleFilterChange({ pdfOnly: !filters.pdfOnly })}
            >
              <MaterialIcons
                name={filters.pdfOnly ? 'check-box' : 'check-box-outline-blank'}
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.checkboxLabel}>PDF files only</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Results */}
      {searching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : results.length > 0 ? (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultCount}>
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </Text>
          <FlatList
            data={results}
            renderItem={renderSearchResultCard}
            keyExtractor={(item) => `${item.resource_type}-${item.resource_id}`}
            scrollEnabled={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          />
        </View>
      ) : searchInput.length > 2 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="search-off" size={48} color={COLORS.textSecondary} />
          <Text style={styles.noResultsTitle}>No results found</Text>
          <Text style={styles.noResultsText}>
            Try different keywords or adjust filters
          </Text>
        </View>
      ) : (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="magnify" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Start searching</Text>
          <Text style={styles.emptyText}>
            Enter 3+ characters to search by subject, keyword, or year
          </Text>
          <Text style={styles.exampleText}>Examples:</Text>
          <Text style={styles.example}>• "BIT DBMS 2080"</Text>
          <Text style={styles.example}>• "DBMS notes"</Text>
          <Text style={styles.example}>• "2080 papers"</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchBarContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 16,
    color: COLORS.text,
  },
  quickFiltersContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: COLORS.surface,
  },
  advancedFiltersContainer: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  resultCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  resultCard: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  resultContent: {
    padding: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 12,
  },
  resultIcon: {
    marginTop: 2,
  },
  resultTitleContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  resultDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  resultTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.background,
  },
  tagText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  resultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  year: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  date: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 4,
  },
  noResultsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  exampleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  example: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
});

