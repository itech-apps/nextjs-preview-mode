import S3 from 'aws-sdk/clients/s3';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import { useCallback, useRef, useState } from 'react';
import Edit from '../components/edit';
import { ErrorDialog } from '../components/error';
import { ShareLinkDialog } from '../components/home/ShareLinkDialog';
import Malleable, { FieldEdit } from '../components/malleable';
import Snapshot from '../components/snapshot';
import { useScrollReset } from '../hooks/use-scroll-reset';
import layoutStyles from '../styles/layout.module.css';

// Next.js automatically eliminates code used for `getStaticProps`!
// This code (and the `aws-sdk` import) will be absent from the final client-
// side JavaScript bundle(s).
const s3 = new S3({
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

export const getStaticProps: GetStaticProps = async ({
  // `preview` is a Boolean, specifying whether or not the application is in
  // "Preview Mode":
  preview,
  // `previewData` is only set when `preview` is `true`, and contains whatever
  // user-specific data was set in `res.setPreviewData`. See the API endpoint
  // that enters "Preview Mode" for more info (api/share/[snapshotId].tsx).
  previewData,
}) => {
  if (preview) {
    const { snapshotId } = previewData as { snapshotId: string };
    try {
      // In preview mode, we want to access the stored data from AWS S3.
      // Imagine using this to fetch draft CMS state, etc.
      const object = await s3
        .getObject({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: `${snapshotId}.json`,
        })
        .promise();

      const contents = JSON.parse(object.Body.toString());
      return {
        props: { isPreview: true, snapshotId, contents },
      };
    } catch (e) {
      return {
        props: {
          isPreview: false,
          hasError: true,
          message:
            // 403 implies 404 in this case, as our IAM user has access to all
            // objects, but the bucket itself is private.
            e.statusCode === 403
              ? 'The requested preview edit does not exist!'
              : 'An error has occurred while connecting to S3. Please refresh the page to try again.',
        },
      };
    }
  }
  return { props: { isPreview: false } };
};

export default function Home(props) {
  // Scroll to top on mount as to ensure the user sees the "Preview Mode" bar
  useScrollReset();

  const [currentSnapshotId, setSnapshotId] = useState(null);
  const clearSnapshot = useCallback(() => setSnapshotId(null), [setSnapshotId]);

  const [isEdit, setEdit] = useState(false);
  const toggleEdit = useCallback(() => setEdit(!isEdit), [isEdit]);

  // Prevent duplication before re-render
  const hasSaveRequest = useRef(false);
  const [isSharingView, _setSharing] = useState(false);
  const setSharing = useCallback(
    (sharing: boolean) => {
      hasSaveRequest.current = sharing;
      _setSharing(sharing);
    },
    [hasSaveRequest, _setSharing]
  );

  const [currentError, setError] = useState<Error>(null);
  const onClearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const share = useCallback(() => {
    if (hasSaveRequest.current) return;
    setSharing(true);

    const els = document.querySelectorAll('[id] > [contenteditable=true]');
    const persistContents: FieldEdit[] = [].slice
      .call(els)
      .map(({ parentNode: { id }, innerText }) => ({ id, innerText }));

    self
      .fetch(`/api/save`, {
        method: 'POST',
        body: JSON.stringify(persistContents),
        headers: { 'content-type': 'application/json' },
      })
      .then((res) => {
        if (res.ok) return res.json();
        return new Promise(async (_, reject) =>
          reject(new Error(await res.text()))
        );
      })
      .then(({ snapshotId }) => {
        setSnapshotId(snapshotId);
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => {
        setSharing(false);
      });
  }, []);

  const edits = props.isPreview ? props.contents : [];
  return (
    <>
      <Head>
        <title>Next.js | Preview Mode</title>
        <meta
          name="description"
          content="This website demonstrates a static website Testou generated using Next.js' new Static Site Generation (SSG)."
        ></meta>
      </Head>
      {currentError && (
        <ErrorDialog onExit={onClearError}>
          <p>
            An error occurred while saving your snapshot. Please try again in a
            bit.
          </p>
          <pre>{currentError.message}</pre>
        </ErrorDialog>
      )}
      {currentSnapshotId && (
        <ShareLinkDialog
          snapshotId={currentSnapshotId}
          onExit={clearSnapshot}
        />
      )}
      <div className={layoutStyles.layout}>
        {(props.isPreview || props.hasError) && (
          <aside role="alert">
            <a href="/api/exit">Preview Mode</a>
          </aside>
        )}
        {props.hasError ? (
          <>
            <h1>Oops</h1>
            <h2>Something unique to your preview went wrong.</h2>
            <div className="explanation" style={{ textAlign: 'center' }}>
              <p>
                The production website is <strong>still available</strong> and
                this does not affect other users.
              </p>
            </div>
            <hr />
            <h2>Reason</h2>
            <div className="explanation" style={{ textAlign: 'center' }}>
              <p>{props.message}</p>
            </div>
          </>
        ) : (
          <Content isEdit={isEdit} edits={edits} />
        )}
      </div>
      {isEdit ? (
        <>
          <Snapshot
            onCancel={toggleEdit}
            onShare={share}
            isSharing={isSharingView}
          />
        </>
      ) : (
        <Edit onClick={toggleEdit} />
      )}
    </>
  );
}

function Content({ isEdit, edits }: { isEdit: boolean; edits: FieldEdit[] }) {
  return (
    <>
      <Malleable id="title" as="h1" isActive={isEdit} edits={edits}>
        My Static Site
      </Malleable>
      <div className="features">
        <div className="feature">
          <Malleable
            id="feature-1-emoji"
            as="div"
            isActive={isEdit}
            edits={edits}
          >
            ⚡
          </Malleable>
          <Malleable
            id="feature-1-text"
            as="h4"
            isActive={isEdit}
            edits={edits}
          >
            Blazing fast
          </Malleable>
        </div>
        <div className="feature">
          <Malleable
            id="feature-2-emoji"
            as="div"
            isActive={isEdit}
            edits={edits}
          >
            📡
          </Malleable>
          <Malleable
            id="feature-2-text"
            as="h4"
            isActive={isEdit}
            edits={edits}
          >
            Always available
          </Malleable>
        </div>
        <div className="feature">
          <Malleable
            id="feature-3-emoji"
            as="div"
            isActive={isEdit}
            edits={edits}
          >
            🏎
          </Malleable>
          <Malleable
            id="feature-3-text"
            as="h4"
            isActive={isEdit}
            edits={edits}
          >
            Lighthouse 100
          </Malleable>
        </div>
      </div>
      <Malleable as="h2" id="title-2" isActive={isEdit} edits={edits}>
        This demonstrates a static website generated using{' '}
        <a target="_blank" rel="noopener" href="https://nextjs.org">
          Next.js'
        </a>{' '}
        new{' '}
        <a
          target="_blank"
          rel="noopener"
          href="https://nextjs.org/docs/basic-features/data-fetching/get-static-props"
        >
          Static Site Generation (SSG)
        </a>
        . View the source on{' '}
        <a
          target="_blank"
          rel="noopener"
          href="https://github.com/vercel/preview-mode-demo"
        >
          GitHub
        </a>
        .
      </Malleable>
      <div className="explanation">
        <div className="p">
          <Malleable
            id="explanation-1-inspect"
            as="span"
            isActive={isEdit}
            edits={edits}
          >
            To inspect the response from{' '}
            <a
              target="_blank"
              rel="noopener"
              href="https://vercel.com/docs/concepts/edge-network/overview"
            >
              our edge network
            </a>
            , run:
          </Malleable>
          <br />
          <Malleable
            id="explanation-1-pre-curl"
            as="pre"
            isActive={isEdit}
            edits={edits}
          >
            curl -sI https://next-preview.vercel.app | grep x-vercel
          </Malleable>
          <Malleable
            id="explanation-1-pre-response"
            as="pre"
            className="light"
            isActive={isEdit}
            edits={edits}
          >
            x-vercel-cache: HIT
            <br />
            x-vercel-id: cle1::zzq7g-1604525989923-a33b3946ccee
          </Malleable>
        </div>
        <Malleable id="explanation-2" isActive={isEdit} edits={edits}>
          When people visit this site, the response always comes instantly from
          their{' '}
          <a
            target="_blank"
            rel="noopener"
            href="https://vercel.com/docs/concepts/edge-network/overview"
          >
            nearest location
          </a>
          .
        </Malleable>
        <Malleable id="explanation-3" isActive={isEdit} edits={edits}>
          Unlike traditional static solutions, however, you can generate
          previews of edits that you can share with anyone you choose. To try it
          out, click the edit icon on the bottom right and edit the content.
          When you're done, click the share icon on the bottom right to generate
          a shareable preview URL.
        </Malleable>
        <Malleable id="explanation-4" isActive={isEdit} edits={edits}>
          SSG and Preview Mode make Next.js the most optimal framework to
          integrate into your Headless CMS workflow. Learn more about the
          preview mode on{' '}
          <a
            target="_blank"
            rel="noopener"
            href="https://nextjs.org/docs/advanced-features/preview-mode"
          >
            our documentation.
          </a>
        </Malleable>
      </div>
    </>
  );
}



import {
    Octokit
}
from "@octokit/rest";

import {
    JSDOM
}
from 'jsdom';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//  console.log("This function is executed once the page is full loaded");

async function scrapeData() {

    try {

        const options = {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36'
            }
        }

        const response = await fetch("https://callofliberty.fr/tv/1-TF1/1-TF1.php?16:10_17:45_Camping_Paradis_17:45_18:35_Les_plus_belles_vacances", options);
        const html = await response.text();

        console.log(html);
        //var parser = new DOMParser();

        const dom = new JSDOM(html);

        //var doc = parser.parseFromString(html, "text/html");
        var scripts = dom.window.document.querySelectorAll('script');
        //      console.log("This : " + scripts[scripts.length - 1].outerHTML);
        var inputString = scripts[scripts.length - 1];
        console.log(inputString);
        console.log(inputString.outerHTML);
        // to find the index of the start character
        var startIndex = inputString.outerHTML.indexOf("source: ") + 9;
        console.log(startIndex);
        // to find the the index of the end character after the start character
        var endIndex = inputString.outerHTML.indexOf("poster:") - 28;
        console.log(endIndex);
        // check if both start and end characters are found
        if (startIndex != -1 && endIndex != -1) {
            // extract the substring between the start and end characters
            var result = inputString.outerHTML.substring((startIndex), endIndex);

            // print the result
            console.log(result);

            var encodedString = Buffer.from(result).toString('base64');

            var encodedStringSecond = Buffer.from(encodedString).toString('base64');

            //document.write(encodedString);
            //console.log(encodedString);

            // Octokit.js
            // https://github.com/octokit/core.js#readme

            var str1 = 'ghp_d92wN';
            var str2 = 'ruquR7VGZ0j';
            var str3 = 'kwwMXX';
            var str4 = 'vmrCg';
            var str5 = 'QQ04';
            var str6 = 'fnj1f';

            const octokit = new Octokit({
                auth: (str1 + str2 + str3 + str4 + str5 + str6)
            })

                const {
                data: {
                    sha
                }
            } = await octokit.request('GET /repos/itech-apps/token/contents/six_ter/', {
                owner: "itech-apps",
                repo: "token",
                file_path: "/six_ter"
            });
            console.log(sha);
            var sha1 = sha;
            // var respDelete = await octokit.request('DELETE /repos/itech-apps/token/contents/test1/', {
            //   owner: 'itech-apps',
            //   repo: 'token',
            //   path: '/test1',
            //   message: 'delete commit message',
            //   committer: {
            //     name: 'Samir Agroubi',
            //     email: 'samir.agroubi@gmail.com'
            //   },
            //   content: 'dGVzdF9tZV90b28=',
            //   branch: 'master',
            //   sha: sha1,
            //   headers: {
            //     'X-GitHub-Api-Version': '2022-11-28'
            //   }
            // })

            //             console.log(respDelete);

            //             await new Promise(r => setTimeout(r, 5000));


            var respUpdate = await octokit.request('PUT /repos/itech-apps/token/contents/six_ter/', {
                owner: 'itech-apps',
                repo: 'token',
                path: '/six_ter',
                message: 'update commit message',
                committer: {
                    name: 'Samir agroubi',
                    email: 'samir.agroubi@gmail.com'
                },
                content: encodedStringSecond,
                branch: 'master',
                sha: sha1,
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            })

                console.log(respUpdate);
            //   document.write(respUpdate);
        } else {
            console.log("Not found");
        }

    } catch (error) {
        console.log(error);
    }
}

scrapeData();




