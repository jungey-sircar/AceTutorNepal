import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  FlatList, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../_lib/api';
import { fetchWithCache } from '../_lib/cache';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../_lib/theme';

interface PastPaper {
  paper_id: string;
  title: string;
  year: number;
  semester?: number;
  exam_type: string;
  pdf_url: string;
  question_count: number;
}

interface StudyNote {
  note_id: string;
  title: string;
  author: string;
  tags: string[];
}

interface VideoSolution {
  video_id: string;
  title: string;
  description: string;
  video_url: string;
  duration_seconds: number;
}

interface Assignment {
  assignment_id: string;
  title: string;
  posted_by_name: string;
  due_date: string;
  total_points?: number;
}

interface ResourceStats {
  node_id: string;
  past_papers_count: number;
  notes_count: number;
  videos_count: number;
  important_questions_count: number;
  assignments_count: number;
  total_resources: number;
}

export interface ResourcesProps {
  nodeId: string;
  nodeName: string;
}

export default function ResourcesViewer({ nodeId, nodeName }: ResourcesProps) {
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([]);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [videos, setVideos] = useState<VideoSolution[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'papers' | 'notes' | 'videos' | 'assignments'>('overview');

  useEffect(() => {
    loadResources();
  }, [nodeId]);

  const loadResources = async () => {
    setLoading(true);
    try {
      const [statsRes, papersRes, notesRes, videosRes, assignRes] = await Promise.all([
        fetchWithCache<ResourceStats>(`resources-stats-${nodeId}`, () =>
          api.get<ResourceStats>(`/resources/${nodeId}/stats`)
        ),
        fetchWithCache<PastPaper[]>(`resources-papers-${nodeId}`, () =>
          api.get<PastPaper[]>(`/resources/${nodeId}/past-papers`)
        ),
        fetchWithCache<StudyNote[]>(`resources-notes-${nodeId}`, () =>
          api.get<StudyNote[]>(`/resources/${nodeId}/notes`)
        ),
        fetchWithCache<VideoSolution[]>(`resources-videos-${nodeId}`, () =>
          api.get<VideoSolution[]>(`/resources/${nodeId}/videos`)
        ),
        fetchWithCache<Assignment[]>(`resources-assignments-${nodeId}`, () =>
          api.get<Assignment[]>(`/resources/${nodeId}/assignments`)
        ),
      ]);

      setStats(statsRes.data);
      setPastPapers(papersRes.data);
      setNotes(notesRes.data);
      setVideos(videosRes.data);
      setAssignments(assignRes.data);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Loading resources...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {([
          { key: 'overview', label: 'Overview', icon: 'grid' },
          { key: 'papers', label: 'Papers', icon: 'document', count: stats?.past_papers_count },
          { key: 'notes', label: 'Notes', icon: 'book', count: stats?.notes_count },
          { key: 'videos', label: 'Videos', icon: 'play-circle', count: stats?.videos_count },
          { key: 'assignments', label: 'Tasks', icon: 'checkbox', count: stats?.assignments_count },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'overview' && stats && (
          <View>
            <Text style={styles.sectionTitle}>Available Resources for {nodeName}</Text>
            <View style={styles.statsGrid}>
              {[
                { icon: 'document', label: 'Past Papers', value: stats.past_papers_count, color: COLORS.primaryLight },
                { icon: 'book', label: 'Study Notes', value: stats.notes_count, color: COLORS.secondaryLight },
                { icon: 'play-circle', label: 'Videos', value: stats.videos_count, color: '#FEF3C7' },
                { icon: 'checkbox', label: 'Assignments', value: stats.assignments_count, color: '#DCFCE7' },
              ].map((stat, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.statBox, { backgroundColor: stat.color }]}
                  onPress={() => {
                    if (stat.value > 0) {
                      if (stat.label === 'Past Papers') setActiveTab('papers');
                      else if (stat.label === 'Study Notes') setActiveTab('notes');
                      else if (stat.label === 'Videos') setActiveTab('videos');
                      else if (stat.label === 'Assignments') setActiveTab('assignments');
                    }
                  }}
                >
                  <Ionicons name={stat.icon as any} size={24} color={COLORS.textPrimary} />
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Quick Access</Text>
            <View style={styles.quickAccessRow}>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => pastPapers.length > 0 && setActiveTab('papers')}
              >
                <Ionicons name="download" size={20} color={COLORS.primary} />
                <Text style={styles.quickButtonText}>Download Papers</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickButton}
                onPress={() => videos.length > 0 && setActiveTab('videos')}
              >
                <Ionicons name="play-outline" size={20} color={COLORS.secondary} />
                <Text style={styles.quickButtonText}>Watch Videos</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'papers' && (
          <View>
            <Text style={styles.sectionTitle}>Past Question Papers</Text>
            {pastPapers.length === 0 ? (
              <Text style={styles.emptyText}>No past papers available yet</Text>
            ) : (
              pastPapers.map((paper) => (
                <TouchableOpacity
                  key={paper.paper_id}
                  style={styles.resourceCard}
                  onPress={() => paper.pdf_url && Linking.openURL(paper.pdf_url)}
                >
                  <Ionicons name="document-text" size={24} color={COLORS.primary} />
                  <View style={styles.resourceInfo}>
                    <Text style={styles.resourceTitle}>{paper.title}</Text>
                    <Text style={styles.resourceMeta}>
                      {paper.year} • {paper.exam_type} • {paper.question_count} questions
                    </Text>
                  </View>
                  <Ionicons name="download" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'notes' && (
          <View>
            <Text style={styles.sectionTitle}>Study Notes</Text>
            {notes.length === 0 ? (
              <Text style={styles.emptyText}>No study notes available yet</Text>
            ) : (
              notes.map((note) => (
                <TouchableOpacity key={note.note_id} style={styles.resourceCard}>
                  <Ionicons name="book" size={24} color={COLORS.secondary} />
                  <View style={styles.resourceInfo}>
                    <Text style={styles.resourceTitle}>{note.title}</Text>
                    <Text style={styles.resourceMeta}>by {note.author}</Text>
                    <View style={styles.tagsRow}>
                      {note.tags.slice(0, 2).map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'videos' && (
          <View>
            <Text style={styles.sectionTitle}>Video Solutions</Text>
            {videos.length === 0 ? (
              <Text style={styles.emptyText}>No video solutions available yet</Text>
            ) : (
              videos.map((video) => (
                <TouchableOpacity
                  key={video.video_id}
                  style={styles.resourceCard}
                  onPress={() => video.video_url && Linking.openURL(video.video_url)}
                >
                  <Ionicons name="play-circle" size={24} color="#F59E0B" />
                  <View style={styles.resourceInfo}>
                    <Text style={styles.resourceTitle}>{video.title}</Text>
                    <Text style={styles.resourceMeta}>
                      {Math.floor(video.duration_seconds / 60)}m {video.duration_seconds % 60}s
                    </Text>
                    <Text style={styles.resourceDesc} numberOfLines={2}>
                      {video.description}
                    </Text>
                  </View>
                  <Ionicons name="open" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'assignments' && (
          <View>
            <Text style={styles.sectionTitle}>Assignments & Tasks</Text>
            {assignments.length === 0 ? (
              <Text style={styles.emptyText}>No assignments available yet</Text>
            ) : (
              assignments.map((assignment) => (
                <TouchableOpacity key={assignment.assignment_id} style={styles.resourceCard}>
                  <Ionicons name="checkbox" size={24} color={COLORS.secondaryDark} />
                  <View style={styles.resourceInfo}>
                    <Text style={styles.resourceTitle}>{assignment.title}</Text>
                    <Text style={styles.resourceMeta}>by {assignment.posted_by_name}</Text>
                    <Text style={styles.resourceMeta}>
                      Due: {new Date(assignment.due_date).toLocaleDateString()}
                      {assignment.total_points && ` • ${assignment.total_points} pts`}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  tabScroll: { maxHeight: 60, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  tabScroll: { backgroundColor: COLORS.surface },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.primary },
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.primary, borderRadius: RADIUS.full, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  content: { padding: SPACING.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  statBox: {
    flex: 1,
    minWidth: '48%',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { fontSize: 22, fontWeight: '900', color: COLORS.textPrimary, marginTop: 4 },
  statLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2 },
  quickAccessRow: { flexDirection: 'row', gap: SPACING.sm },
  quickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  quickButtonText: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  resourceInfo: { flex: 1 },
  resourceTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  resourceMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  resourceDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 16 },
  tagsRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  tag: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 10, fontWeight: '700', color: COLORS.primaryDark },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginVertical: SPACING.lg },
});

