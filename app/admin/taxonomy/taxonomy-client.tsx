"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormSection } from "@/components/sat";
import {
  createTaxonomyNodeSchema,
  taxonomyNodeTypes,
  type CreateTaxonomyNodeInput,
} from "@/contracts/admin";
import { buildTaxonomyTree, taxonomyPathLabel, type TaxonomyNodeBase, type TaxonomyTreeNode } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

interface TaxonomyClientProps {
  nodes: TaxonomyNodeBase[];
}

export function TaxonomyClient({ nodes }: TaxonomyClientProps) {
  const router = useRouter();
  const { roots, byId } = useMemo(() => buildTaxonomyTree(nodes), [nodes]);
  const form = useForm<CreateTaxonomyNodeInput>({
    resolver: zodResolver(createTaxonomyNodeSchema),
    defaultValues: { parentId: "", type: "SKILL", name: "" },
  });

  async function onCreate(values: CreateTaxonomyNodeInput) {
    await fetch("/api/admin/taxonomy/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        label: values.name,
        type: values.type,
        parentId: values.parentId || null,
      }),
    });
    form.reset({ parentId: values.parentId, type: values.type, name: "" });
    router.refresh();
  }

  async function toggleNode(node: TaxonomyNodeBase) {
    await fetch("/api/admin/taxonomy/nodes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: node.id, active: !node.active }),
    });
    router.refresh();
  }

  async function renameNode(node: TaxonomyNodeBase, label: string) {
    const clean = label.trim();
    if (!clean || clean === node.label) return;
    await fetch("/api/admin/taxonomy/nodes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: node.id, name: clean, label: clean }),
    });
    router.refresh();
  }

  function renderNode(node: TaxonomyTreeNode, depth = 0) {
    return (
      <div key={node.id} className={cn("border-b border-gray-100 px-3 py-2 last:border-b-0", depth > 0 && "ml-5 border-l pl-4")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Input
                defaultValue={node.label}
                onBlur={(event) => renameNode(node, event.target.value)}
                className="h-8 max-w-[360px] text-sm"
              />
              <Badge variant={node.active ? "success" : "default"}>{node.type}</Badge>
              {!node.active && <Badge variant="warning">Inactive</Badge>}
            </div>
            <p className="mt-1 truncate text-xs text-gray-400">{taxonomyPathLabel(node.id, byId, node.label)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => toggleNode(node)}>
            {node.active ? "Deactivate" : "Activate"}
          </Button>
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  const saving = form.formState.isSubmitting;

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card padding="md" className="h-fit">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Add Node</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onCreate)} className="space-y-3" noValidate>
            <FormSection>
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-gray-500">Parent</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        <option value="">Root</option>
                        {nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {taxonomyPathLabel(node.id, byId, node.label)}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-gray-500">Type</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        {taxonomyNodeTypes.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-gray-500">Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Node name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormSection>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Adding..." : "Add"}
            </Button>
          </form>
        </Form>
      </Card>
      <Card className="overflow-hidden">
        {roots.map((node) => renderNode(node))}
        {roots.length === 0 && <div className="p-8 text-center text-sm text-gray-400">No taxonomy nodes yet.</div>}
      </Card>
    </div>
  );
}
